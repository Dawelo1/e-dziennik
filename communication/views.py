from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import Message
from .serializers import MessageSerializer

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Użytkownik widzi tylko wiadomości, które sam wysłał 
        LUB które otrzymał.
        """
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(receiver=user)
        )

    def perform_create(self, serializer):
        """
        Przy wysyłaniu wiadomości, automatycznie ustaw nadawcę na zalogowanego użytkownika.
        """
        serializer.save(sender=self.request.user)