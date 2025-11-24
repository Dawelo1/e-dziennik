from rest_framework import serializers
from .models import Message
from users.models import User

class MessageSerializer(serializers.ModelSerializer):
    # Wyświetlamy nazwy nadawcy i odbiorcy (zamiast samych ID), żeby było czytelnie
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    receiver_name = serializers.CharField(source='receiver.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'receiver', 'receiver_name', 'subject', 'body', 'created_at', 'is_read']
        read_only_fields = ['sender', 'created_at', 'is_read'] 
        # Nadawcę ustawiamy automatycznie, datę też.
        # is_read zmienia się osobnym endpointem (lub automatycznie przy otwarciu).