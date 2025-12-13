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
    
class CustomPasswordResetSerializer(serializers.Serializer):
    """
    Serializer, który pozwala wpisać Login LUB Email.
    Jeśli wpisano login -> znajduje email użytkownika i przekazuje go dalej.
    """
    # Używamy CharField zamiast EmailField, żeby nie wyrzucało błędu walidacji
    # jeśli ktoś wpisze login (który nie ma znaku @)
    email = serializers.CharField()

    def validate_email(self, value):
        # 1. Najpierw szukamy po adresie email
        user = User.objects.filter(email=value).first()

        # 2. Jeśli nie znaleziono po emailu, szukamy po nazwie użytkownika (loginie)
        if not user:
            user = User.objects.filter(username=value).first()

        # 3. Jeśli nadal nikogo nie ma -> Błąd
        if not user:
            raise serializers.ValidationError("Nie znaleziono użytkownika o takim loginie lub adresie e-mail.")

        # 4. Ważne: Sprawdzamy, czy użytkownik w ogóle ma wpisany email w bazie
        if not user.email:
            raise serializers.ValidationError("To konto nie ma przypisanego adresu e-mail. Skontaktuj się z Dyrektorem.")

        # 5. Zwracamy EMAIL użytkownika (nawet jeśli wpisał login).
        # Dzięki temu biblioteka 'myśli', że użytkownik wpisał email i wysyła wiadomość.
        return user.email
    
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Zwracamy to, co potrzebne frontendowi do działania
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_director', 'is_parent', 'phone_number', 'avatar']
        read_only_fields = ['id', 'username', 'is_director', 'is_parent']