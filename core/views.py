from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import Child, Payment, Post, Attendance
from .serializers import ChildSerializer, PaymentSerializer, PostSerializer, AttendanceSerializer

class ChildViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ChildSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Child.objects.all()
        return user.children.all()

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
        children = user.children.all()
        
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