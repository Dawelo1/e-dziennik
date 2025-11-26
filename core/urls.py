from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChildViewSet, PaymentViewSet, PostViewSet, AttendanceViewSet, FacilityClosureViewSet, SpecialActivityViewSet, DailyMenuViewSet

# Router automatycznie tworzy ścieżki (np. /api/children/, /api/payments/)
router = DefaultRouter()
router.register(r'children', ChildViewSet, basename='child')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'newsfeed', PostViewSet, basename='newsfeed')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'calendar/closures', FacilityClosureViewSet, basename='closures')
router.register(r'calendar/activities', SpecialActivityViewSet, basename='activities')
router.register(r'menu', DailyMenuViewSet, basename='menu')

urlpatterns = [
    path('', include(router.urls)),
]