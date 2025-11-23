from rest_framework import serializers
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