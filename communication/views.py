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
        Oznacza wiadomości jako przeczytane.
        - Dla Dyrektora (is_director=True): oznacza wiadomości od konkretnego Rodzica skierowane do dowolnego Dyrektora.
        - Dla Rodzica: oznacza wiadomości otrzymane od Dyrekcji.
        """
        user = request.user
        sender_id = request.data.get('sender_id') # ID rodzica przesłane z Reacta

        updated = 0

        # 1. SPRAWDZAMY CZY UŻYTKOWNIK TO DYREKTOR (używając Twojego pola is_director)
        if user.is_director:
            if sender_id:
                # Logika "Wspólnej Skrzynki":
                # Oznaczamy wiadomości, które:
                # a) Wysłał dany Rodzic (sender_id)
                # b) Są skierowane do osoby będącej Dyrektorem (receiver__is_director=True)
                # c) Są nieprzeczytane
                updated = Message.objects.filter(
                    sender_id=sender_id,
                    receiver__is_director=True,  # <--- KLUCZOWA ZMIANA
                    is_read=False
                ).update(is_read=True)
            else:
                # Zabezpieczenie: jeśli frontend nie wysłał sender_id, oznaczamy tylko te do zalogowanego usera
                updated = Message.objects.filter(receiver=user, is_read=False).update(is_read=True)

        # 2. SCENARIUSZ DLA RODZICA (is_director=False)
        else:
            # Rodzic oznacza wiadomości wysłane konkretnie do niego
            updated = Message.objects.filter(receiver=user, is_read=False).update(is_read=True)

        return Response({'status': 'marked', 'updated_count': updated})