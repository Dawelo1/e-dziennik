from rest_framework import status, generics, viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.contrib.auth import update_session_auth_hash
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.contrib.auth.models import update_last_login
from django.db.models import Q
from users.models import User
from core.models import Child, SpecialActivity, GalleryItem, FacilityClosure, Payment
from .permissions import IsDirector
from .serializers import UserManagementSerializer
from .utils import generate_unique_username, generate_secure_password
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
            self.object.director_password_preview = None
            self.object.director_password_preview_active = False
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
        director_avatar = None
        
        # 2. Sprawdź cache dla każdego z nich
        for director in directors:
            cache_key = f'director_online_{director.id}'
            if cache.get(cache_key):
                is_any_online = True   
            if not director_avatar and director.avatar:
                director_avatar = director.avatar.url

        return Response({'is_online': is_any_online, 'avatar': director_avatar})


class NotificationSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    PAYMENT_SEEN_CACHE_TIMEOUT = 60 * 60 * 24 * 30

    def _payments_seen_cache_key(self, user_id, child_id):
        return f'notification_payments_seen_user_{int(user_id)}_child_{int(child_id)}'

    def _resolve_selected_child(self, user, child_id_raw):
        if not child_id_raw:
            return None

        try:
            child_id = int(child_id_raw)
        except (TypeError, ValueError):
            return None

        queryset = Child.objects.filter(id=child_id)
        if not user.is_director:
            queryset = queryset.filter(parents=user)

        return queryset.first()

    def _get_parent_groups(self, user):
        children = user.child.all()
        return [child.group for child in children]

    def _schedule_queryset_for_user(self, user):
        if user.is_director:
            return SpecialActivity.objects.all()

        parent_groups = self._get_parent_groups(user)
        if not parent_groups:
            return SpecialActivity.objects.none()
        return SpecialActivity.objects.filter(groups__in=parent_groups).distinct()

    def _gallery_queryset_for_user(self, user):
        if user.is_director:
            return GalleryItem.objects.all()

        parent_groups = self._get_parent_groups(user)
        if not parent_groups:
            return GalleryItem.objects.filter(target_group__isnull=True)

        return GalleryItem.objects.filter(
            Q(target_group__isnull=True) | Q(target_group__in=parent_groups)
        ).distinct()

    def _payments_queryset_for_user(self, user, selected_child=None):
        if user.is_director:
            queryset = Payment.objects.all()
        else:
            queryset = Payment.objects.filter(child__parents=user)

        if selected_child is not None:
            queryset = queryset.filter(child=selected_child)

        return queryset

    def _get_payments_seen_cursor(self, user, selected_child=None):
        if selected_child is None:
            return int(user.last_seen_payment_id or 0)

        cache_key = self._payments_seen_cache_key(user.id, selected_child.id)
        cached_value = cache.get(cache_key)

        if cached_value is None:
            fallback_value = int(user.last_seen_payment_id or 0)
            cache.set(cache_key, fallback_value, timeout=self.PAYMENT_SEEN_CACHE_TIMEOUT)
            return fallback_value

        try:
            return int(cached_value)
        except (TypeError, ValueError):
            fallback_value = int(user.last_seen_payment_id or 0)
            cache.set(cache_key, fallback_value, timeout=self.PAYMENT_SEEN_CACHE_TIMEOUT)
            return fallback_value

    def _set_payments_seen_cursor(self, user, latest_id, selected_child=None):
        latest_id = int(latest_id or 0)

        if selected_child is None:
            user.last_seen_payment_id = latest_id
            user.save(update_fields=['last_seen_payment_id'])
            return

        cache_key = self._payments_seen_cache_key(user.id, selected_child.id)
        cache.set(cache_key, latest_id, timeout=self.PAYMENT_SEEN_CACHE_TIMEOUT)

    def get(self, request):
        user = request.user
        selected_child_raw = request.query_params.get('child_id')
        selected_child = self._resolve_selected_child(user, selected_child_raw)

        schedule_qs = self._schedule_queryset_for_user(user)
        gallery_qs = self._gallery_queryset_for_user(user)
        calendar_qs = FacilityClosure.objects.all()

        if selected_child_raw and selected_child is None:
            payments_qs = Payment.objects.none()
            payments_seen_cursor = 0
        else:
            payments_qs = self._payments_queryset_for_user(user, selected_child=selected_child)
            payments_seen_cursor = self._get_payments_seen_cursor(user, selected_child=selected_child)

        schedule_extra_changes = int(cache.get(f'notification_schedule_extra_{user.id}', 0) or 0)

        counts = {
            'schedule': schedule_qs.filter(id__gt=user.last_seen_schedule_activity_id).count() + schedule_extra_changes,
            'gallery': gallery_qs.filter(id__gt=user.last_seen_gallery_item_id).count(),
            'calendar': calendar_qs.filter(id__gt=user.last_seen_calendar_closure_id).count(),
            'payments': payments_qs.filter(id__gt=payments_seen_cursor).count(),
        }

        return Response(counts)


class MarkNotificationSeenView(NotificationSummaryView):
    section_to_field = {
        'schedule': 'last_seen_schedule_activity_id',
        'gallery': 'last_seen_gallery_item_id',
        'calendar': 'last_seen_calendar_closure_id',
        'payments': 'last_seen_payment_id',
    }

    def post(self, request):
        user = request.user
        section = request.data.get('section')
        selected_child_raw = request.data.get('child_id') or request.query_params.get('child_id')
        selected_child = self._resolve_selected_child(user, selected_child_raw)

        if section not in self.section_to_field:
            return Response({'error': 'Nieprawidłowa sekcja.'}, status=status.HTTP_400_BAD_REQUEST)

        if section == 'payments' and selected_child_raw and selected_child is None:
            return Response({'error': 'Nieprawidłowe child_id.'}, status=status.HTTP_400_BAD_REQUEST)

        if section == 'schedule':
            latest_id = self._schedule_queryset_for_user(user).order_by('-id').values_list('id', flat=True).first() or 0
        elif section == 'gallery':
            latest_id = self._gallery_queryset_for_user(user).order_by('-id').values_list('id', flat=True).first() or 0
        elif section == 'calendar':
            latest_id = FacilityClosure.objects.order_by('-id').values_list('id', flat=True).first() or 0
        else:
            latest_id = self._payments_queryset_for_user(user, selected_child=selected_child).order_by('-id').values_list('id', flat=True).first() or 0

        if section == 'payments':
            self._set_payments_seen_cursor(user, latest_id, selected_child=selected_child)
        else:
            field_name = self.section_to_field[section]
            setattr(user, field_name, int(latest_id))
            user.save(update_fields=[field_name])

        if section == 'schedule':
            cache.set(f'notification_schedule_extra_{user.id}', 0, timeout=60 * 60 * 24 * 30)

        return Response({'status': 'ok', 'section': section, 'seen_up_to_id': int(latest_id)})

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
        
class UserManagementViewSet(viewsets.ModelViewSet):
    """
    API dla Dyrektora do zarządzania wszystkimi użytkownikami.
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserManagementSerializer
    permission_classes = [IsDirector] # Tylko Dyrektor tu wejdzie
    
    # Dodajemy wyszukiwanie i filtrowanie
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name', 'phone_number']

    @action(detail=False, methods=['get'], url_path='generate-credentials')
    def generate_credentials(self, request):
        return Response({
            'username': generate_unique_username(),
            'password': generate_secure_password(),
        })

    @action(detail=True, methods=['get'], url_path='password-preview')
    def password_preview(self, request, pk=None):
        user = self.get_object()

        if not user.director_password_preview_active or not user.director_password_preview:
            return Response(
                {'detail': 'Podgląd hasła nie jest dostępny dla tego konta.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'id': user.id,
            'username': user.username,
            'password': user.director_password_preview,
        }, status=status.HTTP_200_OK)