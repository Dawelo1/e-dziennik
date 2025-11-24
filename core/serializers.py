from rest_framework import serializers
from django.utils import timezone
import datetime
from .models import Child, Payment, Attendance, Post

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