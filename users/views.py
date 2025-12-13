from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import update_session_auth_hash
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.contrib.auth.models import update_last_login # <--- WAŻNY IMPORT DO DATY LOGOWANIA
from users.models import User

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
    
    def patch(self, request):
        user = request.user
        data = request.data.copy() # Kopia, żeby móc edytować

        # Specjalna logika: Jeśli frontend wyśle 'avatar': 'DELETE', usuwamy zdjęcie
        if data.get('avatar') == 'DELETE':
            user.avatar.delete(save=False) # Usuwa plik
            user.avatar = None # Czyści pole w bazie
            user.save()
            return Response(UserSerializer(user).data)

        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class CustomAuthToken(ObtainAuthToken):
    """
    Logowanie, które:
    1. Zwraca token.
    2. Aktualizuje datę logowania.
    3. Ustawia status ONLINE dla dyrektora.
    """
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        token, created = Token.objects.get_or_create(user=user)

        # 1. Aktualizacja daty w bazie (to już mieliśmy)
        update_last_login(None, user)

        # 2. NOWOŚĆ: Jeśli loguje się Dyrektor -> ustawiamy go jako DOSTĘPNEGO natychmiast
        if user.is_director:
            cache_key = f'director_online_{user.id}'
            cache.set(cache_key, True, 300) # 5 minut (300 sekund)

        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'is_director': user.is_director
        })
    
class DirectorStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. Pobierz wszystkich dyrektorów z bazy
        directors = User.objects.filter(is_director=True)
        
        is_any_online = False
        
        # 2. Sprawdź cache dla każdego z nich
        for director in directors:
            cache_key = f'director_online_{director.id}'
            if cache.get(cache_key):
                is_any_online = True
                break # Wystarczy, że jeden jest online

        return Response({'is_online': is_any_online})

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Próba usunięcia tokena.
        # Jeśli się uda -> zadziała sygnał on_token_delete i usunie cache.
        try:
            request.user.auth_token.delete()
            return Response({"message": "Wylogowano pomyślnie."})
        except Exception as e:
            # Jeśli tokena nie ma lub jest błąd, zwracamy info, ale front to zignoruje
            return Response({"message": "Już wylogowany lub błąd tokena."}, status=200)