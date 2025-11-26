from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import update_session_auth_hash
from .serializers import ChangePasswordSerializer

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