from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.views.static import serve
from django.urls import re_path
from django.conf import settings
from django.conf.urls.static import static
from users.views import CustomAuthToken

# --- KONFIGURACJA PANELU ADMINA ---
admin.site.site_header = "Administracja Przedszkole Pszczółka Maja"
admin.site.site_title = "Pszczółka Maja Admin"
admin.site.index_title = "Panel Zarządzania"

urlpatterns = [
    path('', TemplateView.as_view(template_name='index.html'), name='spa-root'),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': settings.FRONTEND_DIST_DIR / 'assets'}),
    path('favicon.png', serve, {'path': 'favicon.png', 'document_root': settings.FRONTEND_DIST_DIR}),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/communication/', include('communication.urls')),
    path('api/users/', include('users.urls')), 
    path('api-token-auth/', CustomAuthToken.as_view(), name='api_token_auth'),
    re_path(r'^(?!api/|admin/|static/|media/|assets/).*$', TemplateView.as_view(template_name='index.html'), name='spa-fallback'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)