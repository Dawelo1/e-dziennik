from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import update_session_auth_hash
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

# Importy potrzebne do logowania
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

from .serializers import ChangePasswordSerializer, UserSerializer

class ChangePasswordView(generics.UpdateAPIView):
    """
    Pozwala zalogowanemu użytkownikowi zmienić hasło.
    Metoda: PUT
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            # 1. Sprawdź stare hasło
            if not self.object.check_password(serializer.data.get("old_password")):
                return Response(
                    {"old_password": ["Błędne stare hasło."]}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 2. Ustaw nowe hasło
            self.object.set_password(serializer.data.get("new_password"))
            self.object.save()
            
            # 3. Utrzymaj sesję (żeby nie wylogowało po zmianie)
            update_session_auth_hash(request, self.object)

            return Response({"detail": "Hasło zostało zmienione pomyślnie."}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

# --- TO JEST KLUCZOWY BRAKUJĄCY ELEMENT ---
class CustomAuthToken(ObtainAuthToken):
    """
    Logowanie za pomocą LOGINU lub E-MAILA.
    """
    def post(self, request, *args, **kwargs):
        data = request.data.copy()
        login_input = data.get('username') # To co wpisał user (login lub email)
        User = get_user_model()

        # Jeśli wpisano email (małpę), znajdź login tego usera
        if login_input and '@' in login_input:
            try:
                user = User.objects.get(email=login_input)
                data['username'] = user.username
            except User.DoesNotExist:
                pass # Zostawiamy błędny email, system zwróci błąd logowania
        
        serializer = self.serializer_class(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'role': 'director' if user.is_director else 'parent' # Opcjonalnie zwracamy rolę
        })