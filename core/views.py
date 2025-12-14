from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from rest_framework.decorators import action
from .models import Child, Payment, Post, Attendance, DailyMenu, FacilityClosure, SpecialActivity, PostComment, GalleryItem
from .serializers import ChildSerializer, PaymentSerializer, PostSerializer, AttendanceSerializer, FacilityClosureSerializer, SpecialActivitySerializer, DailyMenuSerializer, PostCommentSerializer, GalleryItemSerializer

class ChildViewSet(viewsets.ModelViewSet):
    serializer_class = ChildSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Child.objects.all()
        return user.child.all()
    
    def update(self, request, *args, **kwargs):
        # Zabezpieczenie: Pozwalamy edytować TYLKO medical_info
        # Nawet jak ktoś wyśle inne dane, my je ignorujemy
        if not request.user.is_director:
            allowed_data = {'medical_info': request.data.get('medical_info', '')}
            # Podmieniamy dane w requescie na przefiltrowane
            request._full_data = allowed_data
            
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

class PostViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zwraca listę postów (tablicę).
    Dyrektor widzi wszystko.
    Rodzic widzi posty ogólne ORAZ posty przypisane do grup jego dzieci.
    Obsługuje też lajkowanie i komentowanie.
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # 1. Jeśli to Dyrektor -> widzi wszystko
        if user.is_director:
            return Post.objects.all()
        
        # 2. Jeśli to Rodzic -> pobieramy wszystkie jego dzieci
        # (dzięki related_name='child' w modelu Child - tak jak ustaliśmy wcześniej)
        children = user.child.all()
        
        # Jeśli rodzic nie ma przypisanych dzieci, widzi tylko posty ogólne
        if not children.exists():
            return Post.objects.filter(target_group__isnull=True)

        # 3. Zbieramy grupy wszystkich dzieci rodzica do jednej listy
        # Np. [Grupa Pszczółki, Grupa Motylki]
        parent_groups = [child.group for child in children]
        
        # 4. Filtrujemy posty:
        # Pokaż te, które nie mają grupy (ogólne) 
        # LUB te, które należą do którejś z grup dzieci (target_group__in)
        return Post.objects.filter(
            Q(target_group__isnull=True) | Q(target_group__in=parent_groups)
        ).distinct() # distinct() zapobiega duplikatom jeśli dwoje dzieci jest w tej samej grupie

    # --- NOWE FUNKCJONALNOŚCI ---

    # AKCJA 1: Polub / Odlub
    # Endpoint: POST /api/newsfeed/{id}/like/
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        post = self.get_object()
        user = request.user

        # Sprawdzamy czy user już polubił ten post
        if post.likes.filter(id=user.id).exists():
            post.likes.remove(user) # Usuwamy lajka
            liked = False
        else:
            post.likes.add(user) # Dodajemy lajka
            liked = True

        return Response({
            'liked': liked, 
            'likes_count': post.likes.count()
        })

    # AKCJA 2: Dodaj komentarz
    # Endpoint: POST /api/newsfeed/{id}/comment/
    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        post = self.get_object()
        content = request.data.get('content')

        if not content:
            return Response({'error': 'Treść komentarza jest wymagana'}, status=status.HTTP_400_BAD_REQUEST)

        # Tworzymy komentarz
        comment = PostComment.objects.create(
            post=post,
            author=request.user,
            content=content
        )
        
        # Zwracamy dane nowego komentarza (żeby React mógł go od razu wyświetlić)
        serializer = PostCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)      
      
class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Dyrektor widzi listę dla całego przedszkola
        if user.is_director:
            return Attendance.objects.all()
            
        return Attendance.objects.filter(child__parents=user)
    
class FacilityClosureViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zwraca listę dni, kiedy przedszkole jest zamknięte.
    """
    queryset = FacilityClosure.objects.all()
    serializer_class = FacilityClosureSerializer
    permission_classes = [permissions.IsAuthenticated]

class SpecialActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zwraca zajęcia dodatkowe.
    Rodzic widzi zajęcia przypisane do grup jego dzieci.
    Dyrektor widzi wszystko.
    """
    serializer_class = SpecialActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

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
    
class DailyMenuViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zwraca jadłospis.
    Można filtrować po dacie, np. ?date__gte=2025-11-01&date__lte=2025-11-07
    """
    queryset = DailyMenu.objects.all()
    serializer_class = DailyMenuSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    # Dodajemy proste filtrowanie, żeby React mógł pobrać np. tylko ten tydzień
    def get_queryset(self):
        queryset = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            return queryset.filter(date__range=[start_date, end_date])
        return queryset
    
class GalleryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zwraca listę albumów (Galeria).
    """
    serializer_class = GalleryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # 1. Dyrektor widzi wszystko
        if user.is_director:
            return GalleryItem.objects.all()
        
        # 2. Rodzic widzi albumy ogólne ORAZ przypisane do grup jego dzieci
        
        # --- POPRAWKA TUTAJ: user.child.all() zamiast user.children.all() ---
        children = user.child.all() 
        
        if not children.exists():
            # Jeśli rodzic nie ma przypisanych dzieci, widzi tylko ogólne galerie
            return GalleryItem.objects.filter(target_group__isnull=True)

        parent_groups = [child.group for child in children]
        
        return GalleryItem.objects.filter(
            Q(target_group__isnull=True) | Q(target_group__in=parent_groups)
        ).distinct()
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        album = self.get_object()
        user = request.user

        if album.likes.filter(id=user.id).exists():
            album.likes.remove(user) # Odlubienie
            liked = False
        else:
            album.likes.add(user) # Polubienie
            liked = True

        return Response({
            'liked': liked, 
            'likes_count': album.likes.count()
        })
    
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