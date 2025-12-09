from django.urls import path, include
from .views import ChangePasswordView, CurrentUserView, DirectorStatusView, LogoutView

urlpatterns = [
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # --- RESET HASŁA ---
    # To utworzy endpointy:
    # POST /api/users/password_reset/         -> Zgłoszenie chęci resetu (wysyła maila)
    # POST /api/users/password_reset/confirm/ -> Ustawienie nowego hasła (wymaga tokenu)
    path('password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('director-status/', DirectorStatusView.as_view(), name='director-status'),
    path('logout/', LogoutView.as_view(), name='logout'),
]