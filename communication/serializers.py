from rest_framework import serializers
from .models import Message
from users.models import User

class MessageSerializer(serializers.ModelSerializer):
    # Wyświetlamy nazwy nadawcy i odbiorcy (zamiast samych ID), żeby było czytelnie
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    receiver_name = serializers.CharField(source='receiver.username', read_only=True)
    sender_avatar_url = serializers.SerializerMethodField()
    receiver_avatar_url = serializers.SerializerMethodField()

    def _build_avatar_url(self, user):
        if not user or not user.avatar:
            return None
        request = self.context.get('request')
        avatar_url = user.avatar.url
        return request.build_absolute_uri(avatar_url) if request else avatar_url

    def get_sender_avatar_url(self, obj):
        return self._build_avatar_url(obj.sender)

    def get_receiver_avatar_url(self, obj):
        return self._build_avatar_url(obj.receiver)

    class Meta:
        model = Message
        fields = [
            'id',
            'sender',
            'sender_name',
            'sender_avatar_url',
            'receiver',
            'receiver_name',
            'receiver_avatar_url',
            'subject',
            'body',
            'created_at',
            'is_read',
        ]
        read_only_fields = ['sender', 'created_at', 'is_read'] 
        # Nadawcę ustawiamy automatycznie, datę też.
        # is_read zmienia się osobnym endpointem (lub automatycznie przy otwarciu).
        extra_kwargs = {
            'receiver': {'required': False} 
        }