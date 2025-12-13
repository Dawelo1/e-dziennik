from django.contrib import admin
from django.urls import path, include
from django.conf import settings             
from django.conf.urls.static import static 
from users.views import CustomAuthToken
from django.conf import settings
from django.conf.urls.static import static

# ZMIANA: Importujemy nasz nowy widok, a nie domyślny z rest_framework
from users.views import CustomAuthToken

# --- KONFIGURACJA PANELU ADMINA ---
admin.site.site_header = "Administracja Przedszkole Pszczółka Maja"
admin.site.site_title = "Pszczółka Maja Admin"
admin.site.index_title = "Panel Zarządzania"

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/communication/', include('communication.urls')),
    path('api/users/', include('users.urls')), 
    path('api-token-auth/', CustomAuthToken.as_view(), name='api_token_auth'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)