from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChildViewSet, PaymentViewSet, PostViewSet, AttendanceViewSet

# Router automatycznie tworzy ścieżki (np. /api/children/, /api/payments/)
router = DefaultRouter()
router.register(r'children', ChildViewSet, basename='child')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'newsfeed', PostViewSet, basename='newsfeed')
router.register(r'attendance', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('', include(router.urls)),
]