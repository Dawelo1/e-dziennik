from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import Child, Payment, Post, Attendance, DailyMenu, FacilityClosure, SpecialActivity
from .serializers import ChildSerializer, PaymentSerializer, PostSerializer, AttendanceSerializer, FacilityClosureSerializer, SpecialActivitySerializer, DailyMenuSerializer

class ChildViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ChildSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Child.objects.all()
        return user.child.all()

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
    Rodzic widzi posty ogólne ORAZ posty przypisane do grup jego DZIECI (wszystkich).
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # 1. Jeśli to Dyrektor -> widzi wszystko
        if user.is_director:
            return Post.objects.all()
        
        # 2. Jeśli to Rodzic -> pobieramy wszystkie jego dzieci
        # (dzięki related_name='children' w modelu Child)
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
        )
        
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