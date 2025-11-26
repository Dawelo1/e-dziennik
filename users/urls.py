from django.urls import path, include
from .views import ChangePasswordView

urlpatterns = [
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # --- RESET HASŁA ---
    # To utworzy endpointy:
    # POST /api/users/password_reset/         -> Zgłoszenie chęci resetu (wysyła maila)
    # POST /api/users/password_reset/confirm/ -> Ustawienie nowego hasła (wymaga tokenu)
    path('password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
]