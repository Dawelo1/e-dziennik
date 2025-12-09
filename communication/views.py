from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Message
from .serializers import MessageSerializer
from users.models import User

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Logika widoczności:
        1. Rodzic: Widzi tylko swoje rozmowy.
        2. Dyrektor: Widzi swoje rozmowy ORAZ rozmowy innych dyrektorów (Wspólna skrzynka).
        """
        user = self.request.user

        # SCENARIUSZ 1: Użytkownik jest DYREKTOREM
        if user.is_director:
            return Message.objects.filter(
                Q(sender=user) | 
                Q(receiver=user) |
                Q(receiver__is_director=True) | # Przychodzące do administracji
                Q(sender__is_director=True)     # Wychodzące od administracji
            ).distinct()

        # SCENARIUSZ 2: Użytkownik jest RODZICEM
        else:
            return Message.objects.filter(
                Q(sender=user) | Q(receiver=user)
            )

    def perform_create(self, serializer):
        """
        Logika wysyłania:
        1. Rodzic -> Automatycznie do Dyrektora.
        2. Dyrektor -> Musi wybrać odbiorcę.
        """
        sender = self.request.user

        # A. Wysyła RODZIC
        if sender.is_parent:
            director = User.objects.filter(is_director=True).first()

            if not director:
                raise serializers.ValidationError(
                    {"receiver": "Błąd systemu: Nie znaleziono konta dyrektora. Skontaktuj się z placówką."}
                )

            serializer.save(sender=sender, receiver=director)

        # B. Wysyła DYREKTOR
        else:
            if 'receiver' not in serializer.validated_data:
                 raise serializers.ValidationError({"receiver": "Jako Dyrektor musisz wybrać odbiorcę wiadomości."})
            
            serializer.save(sender=sender)

    # --- NOWE METODY (TEGO BRAKOWAŁO W TWOIM KODZIE) ---

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """
        Zwraca liczbę nieprzeczytanych wiadomości dla zalogowanego użytkownika.
        """
        user = request.user
        count = Message.objects.filter(receiver=user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """
        Oznacza wszystkie wiadomości odebrane przez użytkownika jako przeczytane.
        """
        user = request.user
        updated = Message.objects.filter(receiver=user, is_read=False).update(is_read=True)
        return Response({'status': 'marked', 'updated_count': updated})