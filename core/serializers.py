from rest_framework import serializers
import re
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from datetime import time
from .models import Child, Payment, Attendance, Post, DailyMenu, FacilityClosure, SpecialActivity, PostComment, GalleryItem, GalleryImage, Group, RecurringPayment
from drf_writable_nested import WritableNestedModelSerializer

class ChildSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)

    # Automatyczne rozszyfrowanie medical_info przy odczycie
    class Meta:
        model = Child
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    child_name = serializers.SerializerMethodField(read_only=True)

    def get_child_name(self, obj):
        first_name = (obj.child.first_name or '').strip()
        last_name = (obj.child.last_name or '').strip()
        full_name = f"{first_name} {last_name}".strip()
        return full_name or str(obj.child)

    class Meta:
        model = Payment
        fields = [
            'id',
            'child',
            'child_name',
            'amount',
            'description',
            'is_paid',
            'created_at',
            'payment_title',
            'payment_date',
            'meal_period',
        ]
        read_only_fields = ()


class RecurringPaymentSerializer(serializers.ModelSerializer):
    child_names = serializers.SerializerMethodField(read_only=True)
    child_names_text = serializers.SerializerMethodField(read_only=True)

    def get_child_names(self, obj):
        names = []
        for child in obj.children.all():
            first_name = (child.first_name or '').strip()
            last_name = (child.last_name or '').strip()
            full_name = f"{first_name} {last_name}".strip()
            names.append(full_name or str(child))
        return names

    def get_child_names_text(self, obj):
        return ', '.join(self.get_child_names(obj))

    def validate_children(self, value):
        if not value:
            raise serializers.ValidationError("Wybierz co najmniej jedno dziecko.")
        return value

    class Meta:
        model = RecurringPayment
        fields = [
            'id',
            'children',
            'child_names',
            'child_names_text',
            'amount',
            'description',
            'frequency',
            'next_payment_date',
            'is_active',
        ]

class PostSerializer(serializers.ModelSerializer):
    # Dodajemy sformatowaną datę, żeby na froncie łatwo wyświetlić np. "12 Listopada 2023"
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'image', 'created_at', 'formatted_date', 'target_group']

    def get_formatted_date(self, obj):
        return obj.created_at.strftime("%d-%m-%Y %H:%M")
    
class AttendanceSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.first_name', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'child', 'child_name', 'date', 'status', 'created_at']
        read_only_fields = ['created_at', 'status'] 
        # Status ustawiamy automatycznie na 'absent', rodzic nie wybiera "obecny"

    def validate(self, data):
        # Pobieramy użytkownika, który wysyła żądanie
        request = self.context.get("request")
        target_date = data.get('date')

        if not target_date:
            return data

        # Dla wszystkich ról: nie można zgłaszać nieobecności na dzień wolny
        if target_date.weekday() >= 5:
            raise serializers.ValidationError({'date': "Nie można dodać nieobecności w weekend."})

        if FacilityClosure.objects.filter(date=target_date).exists():
            raise serializers.ValidationError({'date': "Nie można dodać nieobecności w dzień wolny od zajęć."})
        
        # --- ZMIANA: Jeśli to Dyrektor, OMIŃ WSZYSTKIE WALIDACJE CZASOWE ---
        if request and request.user.is_director:
            return data # Zezwól na wszystko

        # --- Logika dla Rodzica (bez zmian) ---
        now = timezone.now()
        today = now.date()

        if target_date < today:
            raise serializers.ValidationError("Nie można zgłaszać nieobecności wstecz.")

        if target_date == today:
            if now.hour >= 7:
                raise serializers.ValidationError("Na dzisiaj można zgłaszać nieobecność tylko do godziny 7:00.")

        return data
    
    def create(self, validated_data):
        # Wymuszamy status 'absent' przy tworzeniu przez API
        validated_data['status'] = 'absent'
        return super().create(validated_data)
    
class FacilityClosureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacilityClosure
        fields = '__all__'

class SpecialActivitySerializer(serializers.ModelSerializer):
    end_time = serializers.TimeField(required=False, allow_null=True)
    groups = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Group.objects.all(),
        required=False,
        allow_empty=True,
    )
    # Wyświetlamy nazwy grup, żeby na froncie było wiadomo dla kogo to jest
    group_names = serializers.StringRelatedField(many=True, source='groups', read_only=True)

    class Meta:
        model = SpecialActivity
        fields = ['id', 'title', 'description', 'date', 'start_time', 'end_time', 'groups', 'group_names']

    def to_internal_value(self, data):
        mutable_data = data.copy()
        if mutable_data.get('end_time') == '':
            mutable_data['end_time'] = None
        return super().to_internal_value(mutable_data)

    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')

        open_time = time(6, 30)
        close_time = time(17, 30)

        if start_time and (start_time < open_time or start_time > close_time):
            raise serializers.ValidationError({
                'start_time': 'Godzina rozpoczęcia musi być w przedziale 06:30–17:30.'
            })

        if end_time and (end_time < open_time or end_time > close_time):
            raise serializers.ValidationError({
                'end_time': 'Godzina zakończenia musi być w przedziale 06:30–17:30.'
            })

        if start_time and end_time and end_time < start_time:
            raise serializers.ValidationError({
                'end_time': 'Godzina zakończenia nie może być wcześniejsza niż godzina rozpoczęcia.'
            })

        return attrs

class DailyMenuSerializer(serializers.ModelSerializer):
    # Dodajemy dzień tygodnia, żeby frontendowi było łatwiej (np. "Poniedziałek")
    day_of_week = serializers.SerializerMethodField()

    class Meta:
        model = DailyMenu
        fields = '__all__'

    def get_day_of_week(self, obj):
        # Zwraca numer dnia (1=Poniedziałek, 7=Niedziela)
        # Frontend sobie to zamieni na nazwę
        return obj.date.isoweekday()

    def validate_allergens(self, value):
        if not value:
            return value

        normalized = value.strip()
        if not normalized:
            return ''

        if not re.fullmatch(r'\d+(\s*,\s*\d+)*', normalized):
            raise serializers.ValidationError('Pole "Alergeny" może zawierać tylko liczby (np. 1, 3, 7).')

        return normalized

# Warto też poprawić to w wiadomościach, jeśli tam jest podobnie:
class MessageSerializer(serializers.ModelSerializer):
    # ... pola ...
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        # ...
        fields = [ ... , 'formatted_date'] # Pamiętaj dodać do fields

    def get_formatted_date(self, obj):
        local_date = timezone.localtime(obj.created_at)
        return local_date.strftime("%d-%m-%Y %H:%M")
    
class PostCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True) # Imię Nazwisko autora
    author_avatar = serializers.ImageField(source='author.avatar', read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked_by_user = serializers.SerializerMethodField()

    class Meta:
        model = PostComment
        fields = ['id', 'author_name', 'author_avatar', 'content', 'created_at', 'likes_count', 'is_liked_by_user']

    def get_is_liked_by_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

class PostSerializer(serializers.ModelSerializer):
    formatted_date = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked_by_user = serializers.SerializerMethodField()
    comments = PostCommentSerializer(many=True, read_only=True)
    likers_names = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'content', 'image', 'created_at', 'formatted_date', 'target_group',
            'likes_count', 'is_liked_by_user', 'comments', 'likers_names'
        ]

    def get_formatted_date(self, obj):
        local_date = timezone.localtime(obj.created_at)
        
        # Dopiero teraz zamieniamy na napis
        return local_date.strftime("%d-%m-%Y %H:%M")
    
    def get_is_liked_by_user(self, obj):
        # Sprawdzamy, czy user wysyłający zapytanie znajduje się na liście lajkujących
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_likers_names(self, obj):
        users = obj.likes.all()
        names = []
        for u in users:
            full_name = u.get_full_name()
            names.append(full_name if full_name else u.username)
        return names
    
class GalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GalleryImage
        fields = ['id', 'image', 'caption']

class GalleryItemSerializer(WritableNestedModelSerializer):
    formatted_date = serializers.SerializerMethodField()
    
    # ZMIANA: Jawnie oznaczamy to pole jako tylko do odczytu dla zapytań GET
    # Drf-writable-nested jest na tyle sprytny, że mimo to pozwoli na zapis
    # przez metody create/update w widoku (bo tam operujemy na danych, a nie na serializerze).
    images = GalleryImageSerializer(many=True, read_only=True) 

    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked_by_user = serializers.SerializerMethodField()
    likers_names = serializers.SerializerMethodField()
    
    # USUWAMY: Te pola, bo model GalleryItem nie ma autora
    # author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    # author_avatar = serializers.ImageField(source='author.avatar', read_only=True)

    class Meta:
        model = GalleryItem
        # Pamiętaj, żeby usunąć 'author_name' i 'author_avatar' z fields!
        fields = [
            'id', 'title', 'description', 'created_at', 'formatted_date', 
            'target_group', 'images', 
            'likes_count', 'is_liked_by_user', 'likers_names'
        ]

    def get_formatted_date(self, obj):
        return obj.created_at.strftime("%d-%m-%Y")

    def get_is_liked_by_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_likers_names(self, obj):
        # Ograniczmy listę np. do 5 ostatnich osób, żeby nie wysyłać setek nazwisk
        users = obj.likes.all()[:5] 
        names = [u.get_full_name() or u.username for u in users]
        return names
    
class GroupSerializer(serializers.ModelSerializer):
    color_key = serializers.CharField(read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'teachers_info', 'color_key']
        read_only_fields = ['color_key']

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages[0] if exc.messages else str(exc)})