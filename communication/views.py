from rest_framework import viewsets, permissions, serializers
from django.db.models import Q
from .models import Message
from .serializers import MessageSerializer
from users.models import User

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Logika widoczności wiadomości:
        1. Rodzic: Widzi tylko swoje rozmowy.
        2. Dyrektor: Widzi swoje rozmowy ORAZ rozmowy innych dyrektorów (Wspólna skrzynka).
        """
        user = self.request.user

        # SCENARIUSZ 1: Użytkownik jest DYREKTOREM
        if user.is_director:
            # Dyrektor widzi:
            # 1. Wiadomości, w których jest nadawcą LUB odbiorcą (standard).
            # 2. ORAZ wiadomości wysłane przez rodziców do INNYCH dyrektorów (receiver__is_director=True).
            # 3. ORAZ wiadomości wysłane przez INNYCH dyrektorów do rodziców (sender__is_director=True).
            
            return Message.objects.filter(
                Q(sender=user) | 
                Q(receiver=user) |
                Q(receiver__is_director=True) | # Przychodzące do administracji
                Q(sender__is_director=True)     # Wychodzące od administracji
            ).distinct() # distinct() usuwa duplikaty, gdyby warunki się pokrywały

        # SCENARIUSZ 2: Użytkownik jest RODZICEM
        else:
            # Rodzic widzi tylko swoje rozmowy
            return Message.objects.filter(
                Q(sender=user) | Q(receiver=user)
            )

    def perform_create(self, serializer):
        """
        Logika wysyłania:
        1. Rodzic: Nie wybiera odbiorcy. System wysyła do pierwszego znalezionego Dyrektora.
        2. Dyrektor: Musi wybrać odbiorcę z listy.
        """
        sender = self.request.user

        # A. Wysyła RODZIC
        if sender.is_parent:
            # Szukamy DOWOLNEGO dyrektora, żeby przypisać go technicznie jako odbiorcę.
            # Dzięki zmianie w get_queryset, WSZYSCY dyrektorzy i tak to zobaczą.
            director = User.objects.filter(is_director=True).first()

            if not director:
                raise serializers.ValidationError(
                    {"receiver": "Błąd systemu: Nie znaleziono konta dyrektora. Skontaktuj się z placówką telefonicznie."}
                )

            # Zapisujemy: Nadawca = Rodzic, Odbiorca = Automatycznie wybrany Dyrektor
            serializer.save(sender=sender, receiver=director)

        # B. Wysyła DYREKTOR (lub Admin)
        else:
            # Dyrektor musi wybrać odbiorcę w formularzu (frontend wyśle ID odbiorcy)
            # Sprawdzamy czy odbiorca został wybrany w danych wejściowych
            if 'receiver' not in serializer.validated_data:
                 raise serializers.ValidationError({"receiver": "Jako Dyrektor musisz wybrać odbiorcę wiadomości."})
            
            serializer.save(sender=sender)