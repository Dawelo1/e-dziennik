from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChangePasswordView, 
    CurrentUserView, 
    DirectorStatusView, 
    LogoutView, 
    UserManagementViewSet
)

# Router automatycznie tworzy ścieżki dla ViewSetów (CRUD)
router = DefaultRouter()
router.register(r'manage', UserManagementViewSet, basename='user-manage')

urlpatterns = [
    # 1. Ścieżki z routera (czyli /api/users/manage/...)
    path('', include(router.urls)),

    # 2. Indywidualne ścieżki (APIView)
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('director-status/', DirectorStatusView.as_view(), name='director-status'),
    path('logout/', LogoutView.as_view(), name='logout'),
]