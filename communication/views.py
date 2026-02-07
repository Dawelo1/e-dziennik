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
        Zaktualizowana logika widoczności:
        1. Rodzic: Widzi tylko swoją rozmowę z Dyrektorem.
        2. Dyrektor: Widzi WSZYSTKIE wiadomości w systemie.
        """
        user = self.request.user

        # A. DYREKTOR widzi całą korespondencję
        if user.is_director:
            # Sortujemy tak, aby najnowsze wiadomości były na dole (jak w czacie)
            return Message.objects.all().order_by('created_at')

        # B. RODZIC widzi tylko swoje wiadomości
        else:
            return Message.objects.filter(
                Q(sender=user) | Q(receiver=user)
            ).order_by('created_at')

    def perform_create(self, serializer):
        """
        Zaktualizowana logika wysyłania:
        1. Rodzic: Automatycznie wysyła do jedynego Dyrektora.
        2. Dyrektor: Musi wybrać odbiorcę (Rodzica).
        """
        sender = self.request.user

        # A. Wysyła RODZIC
        if sender.is_parent:
            # Szukamy jedynego dyrektora w systemie
            director = User.objects.filter(is_director=True).first()

            if not director:
                raise serializers.ValidationError(
                    {"receiver": "Błąd systemu: Nie znaleziono konta dyrektora. Skontaktuj się z placówką."}
                )

            # Zapisujemy wiadomość z automatycznie przypisanym odbiorcą
            serializer.save(sender=sender, receiver=director)

        # B. Wysyła DYREKTOR
        elif sender.is_director:
            # Dyrektor musi podać odbiorcę (rodzica) w danych
            if 'receiver' not in serializer.validated_data:
                 raise serializers.ValidationError({"receiver": "Jako Dyrektor musisz wybrać odbiorcę wiadomości."})
            
            serializer.save(sender=sender)
        
        # C. Ktoś inny (np. Admin bez roli) nie może pisać
        else:
            raise permissions.PermissionDenied("Nie masz uprawnień do wysyłania wiadomości.")

    # --- Metody dodatkowe ---

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
        - Dla Dyrektora (is_director=True): może oznaczyć wiadomości od konkretnego Rodzica.
        - Dla Rodzica: oznacza wszystkie wiadomości otrzymane od Dyrekcji.
        """
        user = request.user
        sender_id = request.data.get('sender_id') # ID rodzica przesłane z Reacta

        # SCENARIUSZ 1: DYREKTOR
        if user.is_director:
            # Jeśli podano sender_id -> oznacz wiadomości tylko od tego rodzica
            if sender_id:
                updated = Message.objects.filter(
                    sender_id=sender_id, # Od tego Rodzica
                    receiver=user,       # Do MNIE (zalogowanego dyrektora)
                    is_read=False
                ).update(is_read=True)
            # Jeśli nie podano -> oznacz wszystkie (jak wcześniej)
            else:
                updated = Message.objects.filter(receiver=user, is_read=False).update(is_read=True)

        # SCENARIUSZ 2: RODZIC
        else:
            # Rodzic zawsze oznacza wszystkie swoje nieprzeczytane wiadomości
            updated = Message.objects.filter(receiver=user, is_read=False).update(is_read=True)

        return Response({'status': 'marked', 'updated_count': updated})