from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Q, Count, F, Case, When, IntegerField
from rest_framework.decorators import action
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Child, GalleryImage, Payment, Post, Attendance, DailyMenu, FacilityClosure, SpecialActivity, PostComment, GalleryItem, Group, RecurringPayment, Preschool
from .serializers import ChildSerializer, PaymentSerializer, RecurringPaymentSerializer, PostSerializer, AttendanceSerializer, FacilityClosureSerializer, SpecialActivitySerializer, DailyMenuSerializer, PostCommentSerializer, GalleryItemSerializer, GroupSerializer, PreschoolSerializer
from users.permissions import IsDirector, IsDirectorOrTeacher
from users.models import User
from rest_framework.views import APIView
from communication.models import Message
from datetime import date, timedelta
from decimal import Decimal
from rest_framework.permissions import AllowAny


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
        child_id = self.request.query_params.get('child_id')

        if user.is_director:
            queryset = Payment.objects.all()
            if child_id:
                queryset = queryset.filter(child_id=child_id)
            return queryset

        queryset = Payment.objects.filter(child__parents=user)
        if child_id:
            queryset = queryset.filter(child_id=child_id)
        return queryset
        
    def perform_update(self, serializer):
        # Zabezpieczenie: tylko dyrektor może zmienić status i datę opłacenia
        if not self.request.user.is_director:
            if 'is_paid' in serializer.validated_data:
                serializer.validated_data.pop('is_paid')
            if 'payment_date' in serializer.validated_data:
                serializer.validated_data.pop('payment_date')
        serializer.save()

    def perform_create(self, serializer):
        if not self.request.user.is_director:
            serializer.validated_data.pop('is_paid', None)
            serializer.validated_data.pop('payment_date', None)

        payment = serializer.save()

        parent_ids = payment.child.parents.values_list('id', flat=True)
        director_ids = User.objects.filter(is_director=True).values_list('id', flat=True)
        target_ids = set(parent_ids) | set(director_ids)
        broadcast_notification_summary_changed(target_ids)


class RecurringPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return RecurringPayment.objects.all()
        return RecurringPayment.objects.filter(children__parents=user).distinct()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()

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
        - Edycja/Usuwanie/Tworzenie -> Dyrektor lub Nauczyciel.
        - Czytanie/Lajkowanie/Komentowanie -> Każdy zalogowany.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirectorOrTeacher()]
        return super().get_permissions()

    # --- TWOJA ORYGINALNA LOGIKA FILTROWANIA (BEZ ZMIAN) ---
    def get_queryset(self):
        user = self.request.user
        child_id = self.request.query_params.get('child_id')
        
        # 1. Jeśli to Dyrektor -> widzi wszystko
        if user.is_director or user.is_teacher:
            queryset = Post.objects.all()
            if child_id:
                try:
                    child = Child.objects.get(id=child_id)
                    return queryset.filter(Q(target_group__isnull=True) | Q(target_group=child.group)).distinct()
                except Child.DoesNotExist:
                    return queryset.none()
            return queryset
        
        # 2. Jeśli to Rodzic -> pobieramy wszystkie jego dzieci
        children = user.child.all()
        
        # Jeśli rodzic nie ma przypisanych dzieci, widzi tylko posty ogólne
        if not children.exists():
            return Post.objects.filter(target_group__isnull=True)

        if child_id:
            selected_child = children.filter(id=child_id).first()
            if not selected_child:
                return Post.objects.none()
            return Post.objects.filter(
                Q(target_group__isnull=True) | Q(target_group=selected_child.group)
            ).distinct()

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
        child_id = self.request.query_params.get('child_id')
        
        # Dyrektor widzi listę dla całego przedszkola
        if user.is_director:
            queryset = Attendance.objects.all()
            if child_id:
                queryset = queryset.filter(child_id=child_id)
            return queryset
            
        queryset = Attendance.objects.filter(child__parents=user)
        if child_id:
            queryset = queryset.filter(child_id=child_id)
        return queryset
    
class FacilityClosureViewSet(viewsets.ModelViewSet):
    """
    Zwraca listę dni, kiedy przedszkole jest zamknięte.
    """
    queryset = FacilityClosure.objects.all()
    serializer_class = FacilityClosureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Dyrektor i nauczyciel mogą edytować
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirectorOrTeacher()]
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
        # Dyrektor i nauczyciel mogą edytować
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirectorOrTeacher()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        child_id = self.request.query_params.get('child_id')
        
        # Dyrektor widzi cały kalendarz
        if user.is_director or user.is_teacher:
            queryset = SpecialActivity.objects.all()
            if child_id:
                try:
                    child = Child.objects.get(id=child_id)
                    return queryset.filter(groups=child.group).distinct()
                except Child.DoesNotExist:
                    return queryset.none()
            return queryset
        
        # Rodzic: pobieramy grupy jego dzieci
        children = user.child.all()
        if not children.exists():
            return SpecialActivity.objects.none()

        if child_id:
            selected_child = children.filter(id=child_id).first()
            if not selected_child:
                return SpecialActivity.objects.none()
            return SpecialActivity.objects.filter(groups=selected_child.group).distinct()
            
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
    queryset = DailyMenu.objects.all().order_by('-week_start_date')
    serializer_class = DailyMenuSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        # Tylko dyrektor może edytować
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirector()]
        return super().get_permissions()
    
    # Filtrowanie po zakresie dat (zwraca jadłospisy, które nachodzą na podany zakres)
    def get_queryset(self):
        queryset = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            try:
                range_start = date.fromisoformat(start_date)
                range_end = date.fromisoformat(end_date)
            except ValueError:
                return queryset.none()

            latest_possible_week_start = range_end
            earliest_possible_week_start = range_start - timedelta(days=4)
            return queryset.filter(
                week_start_date__lte=latest_possible_week_start,
                week_start_date__gte=earliest_possible_week_start,
            )
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
        # Dyrektor i nauczyciel mogą tworzyć/edytować/usuwać albumy
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsDirectorOrTeacher()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        child_id = self.request.query_params.get('child_id')
        
        if user.is_director or user.is_teacher:
            queryset = GalleryItem.objects.all()
            if child_id:
                try:
                    child = Child.objects.get(id=child_id)
                    return queryset.filter(
                        Q(target_group__isnull=True) | Q(target_group=child.group)
                    ).distinct()
                except Child.DoesNotExist:
                    return queryset.none()
            return queryset
        
        children = user.child.all()
        if not children.exists():
            return GalleryItem.objects.filter(target_group__isnull=True)

        if child_id:
            selected_child = children.filter(id=child_id).first()
            if not selected_child:
                return GalleryItem.objects.none()
            return GalleryItem.objects.filter(
                Q(target_group__isnull=True) | Q(target_group=selected_child.group)
            ).distinct()

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

    def _build_attendance_series(self, days, group_id=None):
        today = timezone.localdate()
        start_date = today - timedelta(days=days - 1)

        children_qs = Child.objects.all()
        if group_id is not None:
            children_qs = children_qs.filter(group_id=group_id)

        total_children = children_qs.count()

        absence_qs = Attendance.objects.filter(
            status='absent',
            date__range=(start_date, today),
        )
        if group_id is not None:
            absence_qs = absence_qs.filter(child__group_id=group_id)

        absences_by_date = {
            entry['date']: entry['count']
            for entry in absence_qs.values('date').annotate(count=Count('id'))
        }

        series = []
        for day_index in range(days):
            current_date = start_date + timedelta(days=day_index)
            absent_count = int(absences_by_date.get(current_date, 0) or 0)
            present_count = max(total_children - absent_count, 0)
            attendance_rate = round((present_count / total_children) * 100, 1) if total_children else 0.0

            series.append({
                'date': current_date.isoformat(),
                'label': current_date.strftime('%d.%m'),
                'present': present_count,
                'absent': absent_count,
                'total': total_children,
                'attendance_rate': attendance_rate,
            })

        return series

    def _build_debt_stats(self):
        unpaid_payments = Payment.objects.filter(is_paid=False).select_related(
            'child',
            'child__group',
        ).prefetch_related('child__parents')

        total_outstanding = Decimal('0.00')
        group_totals = {}
        parent_map = {}

        for payment in unpaid_payments:
            payment_amount = payment.amount or Decimal('0.00')
            total_outstanding += payment_amount

            group_obj = payment.child.group
            group_key = int(group_obj.id)
            if group_key not in group_totals:
                group_totals[group_key] = {
                    'group_id': group_key,
                    'group_name': group_obj.name,
                    'amount': Decimal('0.00'),
                    'unpaid_items': 0,
                }
            group_totals[group_key]['amount'] += payment_amount
            group_totals[group_key]['unpaid_items'] += 1

            parent_users = list(payment.child.parents.all())
            for parent in parent_users:
                parent_key = int(parent.id)
                full_name = f"{parent.first_name} {parent.last_name}".strip() or parent.username
                if parent_key not in parent_map:
                    parent_map[parent_key] = {
                        'parent_id': parent_key,
                        'parent_name': full_name,
                        'amount': Decimal('0.00'),
                        'unpaid_items': 0,
                        'group_names': set(),
                        'debts': [],
                    }

                parent_map[parent_key]['amount'] += payment_amount
                parent_map[parent_key]['unpaid_items'] += 1
                parent_map[parent_key]['group_names'].add(group_obj.name)
                parent_map[parent_key]['debts'].append({
                    'payment_id': payment.id,
                    'payment_title': payment.payment_title,
                    'description': payment.description,
                    'amount': float(payment_amount),
                    'group_id': group_key,
                    'group_name': group_obj.name,
                    'child_id': payment.child_id,
                    'child_name': f"{payment.child.first_name} {payment.child.last_name}",
                    'created_at': payment.created_at.isoformat(),
                })

        debtors = []
        for entry in parent_map.values():
            entry['amount'] = float(entry['amount'])
            entry['group_names'] = sorted(list(entry['group_names']))
            entry['debts'].sort(key=lambda debt: debt['created_at'])
            debtors.append(entry)

        debtors.sort(key=lambda debtor: debtor['amount'], reverse=True)

        by_group = []
        for group_entry in group_totals.values():
            by_group.append({
                'group_id': group_entry['group_id'],
                'group_name': group_entry['group_name'],
                'amount': float(group_entry['amount']),
                'unpaid_items': group_entry['unpaid_items'],
            })
        by_group.sort(key=lambda group_entry: group_entry['amount'], reverse=True)

        return {
            'total_outstanding': float(total_outstanding),
            'total_unpaid_items': sum(item['unpaid_items'] for item in by_group),
            'by_group': by_group,
            'debtors': debtors,
            'top_debtor': debtors[0] if debtors else None,
        }

    def _build_unanswered_over_24h(self, director_user):
        threshold = timezone.now() - timedelta(hours=24)

        message_qs = Message.objects.filter(
            Q(sender=director_user) | Q(receiver=director_user)
        ).annotate(
            participant_id=Case(
                When(sender=director_user, then=F('receiver_id')),
                default=F('sender_id'),
                output_field=IntegerField(),
            )
        ).exclude(participant_id=director_user.id).select_related('sender', 'receiver').order_by('participant_id', '-created_at')

        latest_by_participant = {}
        for message in message_qs:
            participant_id = int(message.participant_id)
            if participant_id not in latest_by_participant:
                latest_by_participant[participant_id] = message

        pending = []
        now = timezone.now()
        for participant_id, last_message in latest_by_participant.items():
            if last_message.sender_id == director_user.id:
                continue
            if last_message.created_at > threshold:
                continue

            participant = last_message.sender
            if participant.id == director_user.id:
                participant = last_message.receiver

            if not participant or not participant.is_parent:
                continue

            full_name = f"{participant.first_name} {participant.last_name}".strip() or participant.username
            hours_waiting = int((now - last_message.created_at).total_seconds() // 3600)
            pending.append({
                'participant_id': int(participant.id),
                'participant_name': full_name,
                'last_message_preview': (last_message.body or '')[:100],
                'last_message_at': last_message.created_at.isoformat(),
                'hours_waiting': max(hours_waiting, 24),
            })

        pending.sort(key=lambda item: item['last_message_at'])
        return pending

    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=4)

        # 1. Liczba nieprzeczytanych wiadomości (skierowanych do dyrekcji)
        unread_messages_count = Message.objects.filter(
            receiver=request.user,
            is_read=False
        ).count()

        # 2. Liczba zgłoszonych nieobecności w bieżącym tygodniu roboczym (poniedziałek-piątek)
        absent_week_count = Attendance.objects.filter(
            date__range=(week_start, week_end),
            status='absent'
        ).count()

        # 3. Całkowita liczba dzieci
        total_children_count = Child.objects.count()
        
        # 4. Liczba obecnych (Total - Nieobecni)
        present_today_count = total_children_count - Attendance.objects.filter(
            date=today,
            status='absent'
        ).count()

        # 5. Frekwencja tygodniowa/miesięczna (cała placówka + każda grupa)
        groups = list(Group.objects.order_by('name').values('id', 'name'))
        attendance_week = {'all': self._build_attendance_series(7)}
        attendance_month = {'all': self._build_attendance_series(30)}

        for group in groups:
            group_id = int(group['id'])
            key = str(group_id)
            attendance_week[key] = self._build_attendance_series(7, group_id=group_id)
            attendance_month[key] = self._build_attendance_series(30, group_id=group_id)

        # 6. Zaległości i najwięksi dłużnicy
        debt_stats = self._build_debt_stats()

        # 7. Rozmowy bez odpowiedzi >24h
        unanswered = self._build_unanswered_over_24h(request.user)
        
        # Przygotowujemy dane do wysłania
        stats = {
            'unread_messages': unread_messages_count,
            'absent_today': absent_week_count,
            'absent_week': absent_week_count,
            'present_today': present_today_count,
            'total_children': total_children_count,
            'attendance': {
                'groups': [{'id': 'all', 'name': 'Cała placówka'}] + [
                    {'id': str(group['id']), 'name': group['name']}
                    for group in groups
                ],
                'week': attendance_week,
                'month': attendance_month,
            },
            'debts': debt_stats,
            'unanswered_over_24h': unanswered,
            'unanswered_over_24h_count': len(unanswered),
        }
        
        return Response(stats)

class PreschoolInfoView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        preschool = Preschool.objects.first()
        if not preschool:
            return Response({}, status=404)
        return Response(PreschoolSerializer(preschool).data)