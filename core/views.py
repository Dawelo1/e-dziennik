from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import Child, Payment, Post
from .serializers import ChildSerializer, PaymentSerializer, PostSerializer

class ChildViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ChildSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Child.objects.all()
        # Rodzic widzi tylko przypisane do niego dziecko
        return Child.objects.filter(parent_account=user)

class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_director:
            return Payment.objects.all()
        return Payment.objects.filter(child__parent_account=user)
        
    def perform_update(self, serializer):
        # Zabezpieczenie: tylko dyrektor może zmienić status płatności
        if not self.request.user.is_director and 'is_paid' in serializer.validated_data:
            serializer.validated_data.pop('is_paid')
        serializer.save()

class PostViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zwraca listę postów (tablicę).
    Dyrektor widzi wszystko.
    Rodzic widzi posty ogólne ORAZ posty przypisane do grupy jego dziecka.
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # 1. Jeśli to Dyrektor -> widzi wszystko
        if user.is_director:
            return Post.objects.all()
        
        # 2. Jeśli to Rodzic -> musimy znaleźć grupę jego dziecka
        try:
            child = Child.objects.get(parent_account=user)
            child_group = child.group
            
            # Zwróć posty, które:
            # (Nie mają przypisanej grupy) LUB (Są przypisane do grupy dziecka)
            return Post.objects.filter(
                Q(target_group__isnull=True) | Q(target_group=child_group)
            )
        except Child.DoesNotExist:
            # Jeśli rodzic nie ma przypisanego dziecka, widzi tylko ogólne
            return Post.objects.filter(target_group__isnull=True)