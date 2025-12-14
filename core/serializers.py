from rest_framework import serializers
from django.utils import timezone
from django.utils import timezone
from .models import Child, Payment, Attendance, Post, DailyMenu, FacilityClosure, SpecialActivity, PostComment, GalleryItem, GalleryImage

class ChildSerializer(serializers.ModelSerializer):
    # Automatyczne rozszyfrowanie medical_info przy odczycie
    class Meta:
        model = Child
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ('payment_title', 'is_paid') 
        # is_paid read_only dla rodzica, ale dyrektor musi mieć osobny serializer lub uprawnienie

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
        """
        Tutaj sprawdzamy reguły:
        1. Nie można zgłaszać wstecz.
        2. Nie można zgłaszać na dzisiaj po godzinie 8:00.
        """
        target_date = data['date'] # Data, którą zaznaczył rodzic (nieobecność)
        now = timezone.now()       # Aktualny czas serwera
        today = now.date()

        # Sprawdzenie 1: Czy data nie jest z przeszłości?
        if target_date < today:
            raise serializers.ValidationError("Nie można zgłaszać nieobecności wstecz.")

        # Sprawdzenie 2: Jeśli to dzisiaj, czy jest przed 8:00?
        if target_date == today:
            current_hour = now.hour
            # Uwaga: upewnij się w settings.py że masz TIME_ZONE = 'Europe/Warsaw'
            if current_hour >= 8:
                raise serializers.ValidationError("Na dzisiaj można zgłaszać nieobecność tylko do godziny 8:00.")

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
    # Wyświetlamy nazwy grup, żeby na froncie było wiadomo dla kogo to jest
    group_names = serializers.StringRelatedField(many=True, source='groups', read_only=True)

    class Meta:
        model = SpecialActivity
        fields = ['id', 'title', 'description', 'date', 'start_time', 'end_time', 'groups', 'group_names']

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

class GalleryItemSerializer(serializers.ModelSerializer):
    formatted_date = serializers.SerializerMethodField()
    images = GalleryImageSerializer(many=True, read_only=True)
    
    # NOWE POLA:
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked_by_user = serializers.SerializerMethodField()

    class Meta:
        model = GalleryItem
        # Pamiętaj, żeby dodać nowe pola do listy fields!
        fields = [
            'id', 'title', 'description', 'created_at', 'formatted_date', 
            'target_group', 'images', 
            'likes_count', 'is_liked_by_user' # <--- Dodaj to
        ]

    def get_formatted_date(self, obj):
        return obj.created_at.strftime("%d-%m-%Y")

    # NOWA METODA:
    def get_is_liked_by_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False