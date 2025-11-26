from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):
        # Walidacja długości hasła
        if len(value) < 5:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 5 znaków.")
        return value