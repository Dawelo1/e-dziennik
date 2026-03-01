from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from rest_framework.decorators import action
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Child, GalleryImage, Payment, Post, Attendance, DailyMenu, FacilityClosure, SpecialActivity, PostComment, GalleryItem, Group
from .serializers import ChildSerializer, PaymentSerializer, PostSerializer, AttendanceSerializer, FacilityClosureSerializer, SpecialActivitySerializer, DailyMenuSerializer, PostCommentSerializer, GalleryItemSerializer, GroupSerializer
from users.permissions import IsDirector
from users.models import User
from rest_framework.views import APIView
from communication.models import Message
from .time_utils import now as effective_now, today as effective_today, get_time_override, set_time_override, clear_time_override, is_test_clock_enabled


def broadcast_notification_summary_changed(user_ids=None):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    if user_ids is None:
        user_ids = User.objects.values_list('id', flat=True)

    for user_id in user_ids:
        async_to_sync(channel_layer.group_send)(
            f'user_{int(user_id)}',
            {
                'type': 'chat.notification_summary_changed',
            }
        )


def increment_schedule_change_notification(user_ids):
    for user_id in set(user_ids):
        cache_key = f'notification_schedule_extra_{int(user_id)}'
        current_value = int(cache.get(cache_key, 0) or 0)
        cache.set(cache_key, current_value + 1, timeout=60 * 60 * 24 * 30)

class ChildViewSet(viewsets.ModelViewSet):
    serializer_class = ChildSerializer
    permission_classes = [permissions.IsAuthenticated]

    # USUNĘLIŚMY LINIĘ: http_method_names = [...] 
    # Teraz domyślnie dozwolone jest wszystko, ale ograniczymy to poniżej.

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Child.objects.all()
        return user.child.all() # Upewnij się, że masz tu .children.all() (zależnie od related_name w models.py, chyba zmienialiśmy na .child.all()?)
        # SPRAWDŹ models.py: 
        # Jeśli w models.py Child ma: parents = ManyToManyField(..., related_name='children') -> to użyj user.children.all()
        # Jeśli w models.py Child ma: parents = ManyToManyField(..., related_name='child') -> to użyj user.child.all()
        # (Wcześniej poprawialiśmy błąd na .child.all(), więc trzymajmy się tego co działa u Ciebie)

    def get_permissions(self):
        """
        Dyrektor: Pełen dostęp (Create, Delete, Update).
        Rodzic: Tylko odczyt (Get) i aktualizacja medyczna (Patch).
        """
        if self.action in ['create', 'destroy']:
            return [IsDirector()] # Tylko dyrektor może tworzyć/usuwać
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        # Logika dla Rodzica (zabezpieczenie pól)
        if not request.user.is_director:
            # Pozwalamy edytować TYLKO medical_info
            allowed_data = {'medical_info': request.data.get('medical_info', request.data.get('medical_info', ''))}
            
            # Jeśli rodzic próbuje zmienić coś innego, ignorujemy to
            # (Nadpisujemy dane wejściowe tylko dozwolonym polem)
            serializer = self.get_serializer(self.get_object(), data=allowed_data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
            
        # Logika dla Dyrektora (pełna edycja)
        return super().update(request, *args, **kwargs)

class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Payment.objects.all()
        return Payment.objects.filter(child__parents=user)
        
    def perform_update(self, serializer):
        # Zabezpieczenie: tylko dyrektor może zmienić status płatności
        if not self.request.user.is_director and 'is_paid' in serializer.validated_data:
            serializer.validated_data.pop('is_paid')
        serializer.save()

    def perform_create(self, serializer):
        payment = serializer.save()

        parent_ids = payment.child.parents.values_list('id', flat=True)
        director_ids = User.objects.filter(is_director=True).values_list('id', flat=True)
        target_ids = set(parent_ids) | set(director_ids)
        broadcast_notification_summary_changed(target_ids)

class PostViewSet(viewsets.ModelViewSet): # <--- ZMIANA 1: ModelViewSet (zamiast ReadOnly)
    """
    Zwraca listę postów (tablicę).
    Dyrektor: Pełny dostęp (CRUD).
    Rodzic: Widzi posty ogólne ORAZ przypisane do grup jego dzieci. Może lajkować/komentować.
    """
    serializer_class = PostSerializer
    # Domyślnie wymagamy zalogowania (dla listowania, lajków itp.)
    permission_classes = [permissions.IsAuthenticated]

    # --- ZMIANA 2: OCHRONA ZAPISU ---
    def get_permissions(self):
        """
        Dynamiczne przydzielanie uprawnień:
        - Edycja/Usuwanie/Tworzenie -> Tylko Dyrektor.
        - Czytanie/Lajkowanie/Komentowanie -> Każdy zalogowany.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()

    # --- TWOJA ORYGINALNA LOGIKA FILTROWANIA (BEZ ZMIAN) ---
    def get_queryset(self):
        user = self.request.user
        
        # 1. Jeśli to Dyrektor -> widzi wszystko
        if user.is_director:
            return Post.objects.all()
        
        # 2. Jeśli to Rodzic -> pobieramy wszystkie jego dzieci
        children = user.child.all()
        
        # Jeśli rodzic nie ma przypisanych dzieci, widzi tylko posty ogólne
        if not children.exists():
            return Post.objects.filter(target_group__isnull=True)

        # 3. Zbieramy grupy wszystkich dzieci rodzica do jednej listy
        parent_groups = [child.group for child in children]
        
        # 4. Filtrujemy posty
        return Post.objects.filter(
            Q(target_group__isnull=True) | Q(target_group__in=parent_groups)
        ).distinct()

    # --- TWOJE ORYGINALNE AKCJE (BEZ ZMIAN) ---

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        post = self.get_object()
        user = request.user

        if post.likes.filter(id=user.id).exists():
            post.likes.remove(user)
            liked = False
        else:
            post.likes.add(user)
            liked = True

        return Response({
            'liked': liked, 
            'likes_count': post.likes.count()
        })

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        post = self.get_object()
        content = request.data.get('content')

        if not content:
            return Response({'error': 'Treść komentarza jest wymagana'}, status=status.HTTP_400_BAD_REQUEST)

        comment = PostComment.objects.create(
            post=post,
            author=request.user,
            content=content
        )
        
        serializer = PostCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)    

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        instance.title = request.data.get('title', instance.title)
        instance.content = request.data.get('content', instance.content)

        target_group_id = request.data.get('target_group')
        if target_group_id:
            instance.target_group_id = target_group_id
        else:
            instance.target_group = None

        new_image = request.FILES.get('image')
        if new_image:
            if instance.image:
                instance.image.delete(save=False)
            instance.image = new_image

        delete_image_value = str(request.data.get('delete_image', '')).strip().lower()
        delete_image = delete_image_value in ['1', 'true', 'yes', 'on']

        if delete_image and not new_image:
            if instance.image:
                instance.image.delete(save=False)
            instance.image = None

        instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)
      
class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Dyrektor widzi listę dla całego przedszkola
        if user.is_director:
            return Attendance.objects.all()
            
        return Attendance.objects.filter(child__parents=user)
    
class FacilityClosureViewSet(viewsets.ModelViewSet):
    """
    Zwraca listę dni, kiedy przedszkole jest zamknięte.
    """
    queryset = FacilityClosure.objects.all()
    serializer_class = FacilityClosureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Tylko dyrektor może edytować
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save()
        broadcast_notification_summary_changed()

class SpecialActivityViewSet(viewsets.ModelViewSet):
    """
    Zwraca zajęcia dodatkowe.
    Rodzic widzi zajęcia przypisane do grup jego dzieci.
    Dyrektor widzi wszystko.
    """
    serializer_class = SpecialActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Tylko dyrektor może edytować
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        
        # Dyrektor widzi cały kalendarz
        if user.is_director:
            return SpecialActivity.objects.all()
        
        # Rodzic: pobieramy grupy jego dzieci
        children = user.child.all()
        if not children.exists():
            return SpecialActivity.objects.none()
            
        parent_groups = [child.group for child in children]
        
        # Filtrujemy zajęcia, które są przypisane do którejkolwiek z tych grup
        # distinct() jest ważne przy ManyToMany, żeby nie dublować wyników
        return SpecialActivity.objects.filter(groups__in=parent_groups).distinct()

    def _get_activity_notification_target_ids(self, group_ids):
        normalized_group_ids = set(group_ids)
        if not normalized_group_ids:
            normalized_group_ids = set(Group.objects.values_list('id', flat=True))

        parent_ids = User.objects.filter(child__group_id__in=normalized_group_ids).values_list('id', flat=True).distinct()
        director_ids = User.objects.filter(is_director=True).values_list('id', flat=True)
        return set(parent_ids) | set(director_ids)

    def perform_create(self, serializer):
        activity = serializer.save()

        group_ids = activity.groups.values_list('id', flat=True)
        target_ids = self._get_activity_notification_target_ids(group_ids)
        broadcast_notification_summary_changed(target_ids)

    def perform_update(self, serializer):
        previous_group_ids = serializer.instance.groups.values_list('id', flat=True)
        activity = serializer.save()
        updated_group_ids = activity.groups.values_list('id', flat=True)

        all_relevant_group_ids = set(previous_group_ids) | set(updated_group_ids)
        target_ids = self._get_activity_notification_target_ids(all_relevant_group_ids)
        increment_schedule_change_notification(target_ids)
        broadcast_notification_summary_changed(target_ids)

    def perform_destroy(self, instance):
        group_ids = instance.groups.values_list('id', flat=True)
        target_ids = self._get_activity_notification_target_ids(group_ids)
        instance.delete()
        increment_schedule_change_notification(target_ids)
        broadcast_notification_summary_changed(target_ids)
    
class DailyMenuViewSet(viewsets.ModelViewSet):
    """
    Zwraca jadłospis.
    Można filtrować po dacie, np. ?date__gte=2025-11-01&date__lte=2025-11-07
    """
    queryset = DailyMenu.objects.all().order_by('-date')
    serializer_class = DailyMenuSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        # Tylko dyrektor może edytować
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()
    
    # Dodajemy proste filtrowanie, żeby React mógł pobrać np. tylko ten tydzień
    def get_queryset(self):
        queryset = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            return queryset.filter(date__range=[start_date, end_date])
        return queryset
    
class GalleryViewSet(viewsets.ModelViewSet):
    """
    Zarządzanie albumami (Galeria).
    Dyrektor: Pełny dostęp (CRUD + obsługa plików).
    Rodzic: Tylko odczyt + lajki.
    """
    serializer_class = GalleryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Tylko dyrektor może tworzyć/edytować/usuwać albumy
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        
        if user.is_director:
            return GalleryItem.objects.all()
        
        children = user.child.all()
        if not children.exists():
            return GalleryItem.objects.filter(target_group__isnull=True)

        parent_groups = [child.group for child in children]
        
        return GalleryItem.objects.filter(
            Q(target_group__isnull=True) | Q(target_group__in=parent_groups)
        ).distinct()

    # --- AKCJA LAJKOWANIA ALBUMU ---
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        album = self.get_object()
        user = request.user

        if album.likes.filter(id=user.id).exists():
            album.likes.remove(user)
            liked = False
        else:
            album.likes.add(user)
            liked = True

        return Response({
            'liked': liked, 
            'likes_count': album.likes.count()
        })

    # --- NOWA METODA CREATE (dla wielu zdjęć z Frontendu) ---
    def create(self, request, *args, **kwargs):
        title = request.data.get('title')
        description = request.data.get('description', '')
        target_group_id = request.data.get('target_group')
        
        if not title:
            return Response({'title': 'Tytuł jest wymagany.'}, status=status.HTTP_400_BAD_REQUEST)
        
        album = GalleryItem.objects.create(
            title=title,
            description=description,
            target_group_id=target_group_id if target_group_id else None
        )
        
        # Pobieramy listę plików (zdjęć)
        images = request.FILES.getlist('images')
        
        # W pętli tworzymy obiekty GalleryImage
        for image_file in images:
            GalleryImage.objects.create(gallery_item=album, image=image_file)

        if album.target_group_id:
            parent_ids = User.objects.filter(child__group_id=album.target_group_id).values_list('id', flat=True).distinct()
            director_ids = User.objects.filter(is_director=True).values_list('id', flat=True)
            target_ids = set(parent_ids) | set(director_ids)
            broadcast_notification_summary_changed(target_ids)
        else:
            broadcast_notification_summary_changed()
            
        serializer = self.get_serializer(album)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # --- NOWA METODA UPDATE (dla edycji zdjęć) ---
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # 1. Aktualizuj dane tekstowe
        instance.title = request.data.get('title', instance.title)
        instance.description = request.data.get('description', instance.description)
        
        target_group_id = request.data.get('target_group')
        if target_group_id:
            instance.target_group_id = target_group_id
        else:
            instance.target_group = None
        instance.save()
        
        # 2. Dodawanie nowych zdjęć
        new_images = request.FILES.getlist('images')
        for image_file in new_images:
            GalleryImage.objects.create(gallery_item=instance, image=image_file)

        # 3. Usuwanie starych zdjęć
        # Frontend wyśle listę ID zdjęć do usunięcia, np. 'deleted_images': [1, 5, 12]
        deleted_images_ids = request.data.getlist('deleted_images', [])
        if deleted_images_ids:
            GalleryImage.objects.filter(id__in=deleted_images_ids, gallery_item=instance).delete()
            
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
class CommentViewSet(viewsets.GenericViewSet):
    queryset = PostComment.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    # AKCJA: Polub komentarz
    # POST /api/comments/{id}/like/
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        comment = self.get_object()
        user = request.user

        if comment.likes.filter(id=user.id).exists():
            comment.likes.remove(user)
            liked = False
        else:
            comment.likes.add(user)
            liked = True

        return Response({
            'liked': liked, 
            'likes_count': comment.likes.count()
        })

class GroupViewSet(viewsets.ModelViewSet): # Zmieniamy na ModelViewSet (pełny dostęp)
    serializer_class = GroupSerializer # Zakładam, że masz ten serializer w core/serializers.py
    # Domyślne uprawnienie: Zalogowany (żeby rodzic widział grupy)
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.all()

    def get_permissions(self):
        """
        Dostosowujemy uprawnienia w zależności od akcji.
        - Przeglądanie (list, retrieve): Każdy zalogowany (Rodzic/Dyrektor)
        - Edycja/Usuwanie/Tworzenie: Tylko Dyrektor
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()
    
class DirectorStatsView(APIView):
    """
    Zwraca statystyki dla pulpitu dyrektora.
    """
    permission_classes = [IsDirector] # Tylko dyrektor

    def get(self, request):
        today = effective_today()

        # 1. Liczba nieprzeczytanych wiadomości (skierowanych do dyrekcji)
        unread_messages_count = Message.objects.filter(
            receiver__is_director=True, 
            is_read=False
        ).count()

        # 2. Liczba zgłoszonych nieobecności na dzisiaj
        absent_today_count = Attendance.objects.filter(
            date=today, 
            status='absent'
        ).count()

        # 3. Całkowita liczba dzieci
        total_children_count = Child.objects.count()
        
        # 4. Liczba obecnych (Total - Nieobecni)
        present_today_count = total_children_count - absent_today_count
        
        # Przygotowujemy dane do wysłania
        stats = {
            'unread_messages': unread_messages_count,
            'absent_today': absent_today_count,
            'present_today': present_today_count,
            'total_children': total_children_count,
        }
        
        return Response(stats)


class TestClockView(APIView):
    permission_classes = [IsDirector]

    def get(self, request):
        override_value = get_time_override()
        current_server_now = timezone.now()
        effective_value = effective_now()

        return Response({
            'enabled': is_test_clock_enabled(),
            'server_now': current_server_now.isoformat(),
            'effective_now': effective_value.isoformat(),
            'override': override_value.isoformat() if override_value else None,
        })

    def post(self, request):
        if not is_test_clock_enabled():
            return Response({'detail': 'Test clock jest wyłączony.'}, status=status.HTTP_403_FORBIDDEN)

        raw_datetime = request.data.get('datetime')

        if raw_datetime in [None, '', 'null']:
            clear_time_override()
            return self.get(request)

        try:
            parsed = timezone.datetime.fromisoformat(str(raw_datetime))
        except ValueError:
            return Response({'datetime': 'Nieprawidłowy format. Użyj ISO, np. 2026-03-01T08:30:00'}, status=status.HTTP_400_BAD_REQUEST)

        set_time_override(parsed)
        return self.get(request)