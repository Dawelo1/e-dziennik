from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
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
            message = serializer.save(sender=sender, receiver=director)
            self._broadcast_new_message(message)
            self._send_unread_count_update(message.receiver_id)

        # B. Wysyła DYREKTOR
        elif sender.is_director:
            # Dyrektor musi podać odbiorcę (rodzica) w danych
            if 'receiver' not in serializer.validated_data:
                 raise serializers.ValidationError({"receiver": "Jako Dyrektor musisz wybrać odbiorcę wiadomości."})
            
            message = serializer.save(sender=sender)
            self._broadcast_new_message(message)
            self._send_unread_count_update(message.receiver_id)
        
        # C. Ktoś inny (np. Admin bez roli) nie może pisać
        else:
            raise permissions.PermissionDenied("Nie masz uprawnień do wysyłania wiadomości.")

    def _send_ws_event(self, user_id, event_type, payload):
        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}',
            {
                'type': event_type,
                **payload,
            }
        )

    def _send_unread_count_update(self, user_id):
        count = Message.objects.filter(receiver_id=user_id, is_read=False).count()
        self._send_ws_event(user_id, 'chat.unread_count', {'count': count})

    def _broadcast_new_message(self, message):
        serializer = MessageSerializer(message, context={'request': self.request})
        payload = {'message': serializer.data}
        self._send_ws_event(message.sender_id, 'chat.message', payload)
        if message.receiver_id != message.sender_id:
            self._send_ws_event(message.receiver_id, 'chat.message', payload)

    def _mark_messages_read(self, reader_id, participant_id):
        unread_qs = Message.objects.filter(
            sender_id=participant_id,
            receiver_id=reader_id,
            is_read=False,
        )
        read_message_ids = list(unread_qs.values_list('id', flat=True))

        if not read_message_ids:
            return 0

        unread_qs.update(is_read=True)

        payload = {
            'reader_id': reader_id,
            'participant_id': int(participant_id),
            'read_message_ids': read_message_ids,
        }
        self._send_ws_event(reader_id, 'chat.conversation_read', payload)
        self._send_ws_event(int(participant_id), 'chat.conversation_read', payload)
        self._send_unread_count_update(reader_id)
        return len(read_message_ids)

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
    def mark_conversation_read(self, request):
        """
        Oznacza wiadomości jako przeczytane tylko w jednej rozmowie.
        - Dyrektor: wymagany participant_id (ID rodzica).
        - Rodzic: participant_id opcjonalne; domyślnie rozmowa z dyrektorem.
        """
        user = request.user
        participant_id = request.data.get('participant_id')

        if user.is_director:
            if not participant_id:
                return Response(
                    {'error': 'participant_id jest wymagane dla dyrektora.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            updated = self._mark_messages_read(user.id, participant_id)

            return Response({'status': 'marked', 'updated_count': updated})

        if participant_id:
            updated = self._mark_messages_read(user.id, participant_id)
        else:
            director = User.objects.filter(is_director=True).first()
            if not director:
                return Response({'status': 'marked', 'updated_count': 0})

            updated = self._mark_messages_read(user.id, director.id)

        return Response({'status': 'marked', 'updated_count': updated})

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
                updated = self._mark_messages_read(user.id, sender_id)
            # Jeśli nie podano -> oznacz wszystkie (jak wcześniej)
            else:
                sender_ids = Message.objects.filter(
                    receiver=user,
                    is_read=False,
                ).values_list('sender_id', flat=True).distinct()

                updated = 0
                for participant in sender_ids:
                    updated += self._mark_messages_read(user.id, participant)

        # SCENARIUSZ 2: RODZIC
        else:
            if sender_id:
                updated = self._mark_messages_read(user.id, sender_id)
            else:
                sender_ids = Message.objects.filter(
                    receiver=user,
                    is_read=False,
                ).values_list('sender_id', flat=True).distinct()

                updated = 0
                for participant in sender_ids:
                    updated += self._mark_messages_read(user.id, participant)

        return Response({'status': 'marked', 'updated_count': updated})