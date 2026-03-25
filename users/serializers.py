from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):
        # Walidacja długości hasła
        if len(value) < 5:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 5 znaków.")
        return value
    
class CustomPasswordResetSerializer(serializers.Serializer):
    """
    Serializer, który pozwala wpisać Login LUB Email.
    Jeśli wpisano login -> znajduje email użytkownika i przekazuje go dalej.
    """
    # Używamy CharField zamiast EmailField, żeby nie wyrzucało błędu walidacji
    # jeśli ktoś wpisze login (który nie ma znaku @)
    email = serializers.CharField()

    def validate_email(self, value):
        # 1. Najpierw szukamy po adresie email
        user = User.objects.filter(email=value).first()

        # 2. Jeśli nie znaleziono po emailu, szukamy po nazwie użytkownika (loginie)
        if not user:
            user = User.objects.filter(username=value).first()

        # 3. Jeśli nadal nikogo nie ma -> Błąd
        if not user:
            raise serializers.ValidationError("Nie znaleziono użytkownika o takim loginie lub adresie e-mail.")

        # 4. Ważne: Sprawdzamy, czy użytkownik w ogóle ma wpisany email w bazie
        if not user.email:
            raise serializers.ValidationError("To konto nie ma przypisanego adresu e-mail. Skontaktuj się z Dyrektorem.")

        # 5. Zwracamy EMAIL użytkownika (nawet jeśli wpisał login).
        # Dzięki temu biblioteka 'myśli', że użytkownik wpisał email i wysyła wiadomość.
        return user.email
    
class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    child_groups = serializers.SerializerMethodField()

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        avatar_url = obj.avatar.url
        return request.build_absolute_uri(avatar_url) if request else avatar_url

    def get_child_groups(self, obj):
        if not obj.is_parent:
            return []
        return list(
            obj.child.values_list('group__name', flat=True).distinct().order_by('group__name')
        )

    class Meta:
        model = User
        # Zwracamy to, co potrzebne frontendowi do działania
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_director', 'is_parent', 'is_teacher', 'phone_number', 'avatar', 'avatar_url', 'child_groups']
        read_only_fields = ['id', 'username', 'is_director', 'is_parent', 'is_teacher']

class UserManagementSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    can_preview_password = serializers.SerializerMethodField()
    password_generated = serializers.BooleanField(write_only=True, required=False, default=False)

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        avatar_url = obj.avatar.url
        return request.build_absolute_uri(avatar_url) if request else avatar_url

    def get_can_preview_password(self, obj):
        if obj.is_teacher:
            return True
        return bool(obj.director_password_preview_active and obj.director_password_preview)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'is_director', 'is_parent', 'is_teacher', 'avatar', 'avatar_url', 'password', 'password_generated', 'can_preview_password', 'last_login']
        read_only_fields = ['last_login']
        extra_kwargs = {'password': {'write_only': True, 'required': False}} # Hasło write-only

    def validate(self, attrs):
        requested_teacher = bool(attrs.get('is_teacher', getattr(self.instance, 'is_teacher', False)))
        requested_director = bool(attrs.get('is_director', getattr(self.instance, 'is_director', False)))
        requested_parent = bool(attrs.get('is_parent', getattr(self.instance, 'is_parent', True)))

        if requested_teacher and (self.instance is None or not getattr(self.instance, 'is_teacher', False)):
            raise serializers.ValidationError({'is_teacher': 'Dyrektor nie może dodać nowego nauczyciela.'})

        if requested_teacher and requested_director:
            raise serializers.ValidationError({'is_teacher': 'Konto nie może być jednocześnie nauczycielem i dyrektorem.'})

        if requested_teacher and requested_parent:
            raise serializers.ValidationError({'is_teacher': 'Konto nauczyciela nie może mieć roli rodzica.'})

        if requested_teacher:
            teacher_qs = User.objects.filter(is_teacher=True)
            if self.instance:
                teacher_qs = teacher_qs.exclude(pk=self.instance.pk)
            if teacher_qs.exists():
                raise serializers.ValidationError({'is_teacher': 'W systemie może istnieć maksymalnie 1 nauczyciel.'})

        return attrs

    def _normalize_role_flags(self, validated_data, instance=None):
        is_director = bool(validated_data.get('is_director', getattr(instance, 'is_director', False)))
        is_teacher = bool(validated_data.get('is_teacher', getattr(instance, 'is_teacher', False)))

        if instance is None:
            is_teacher = False
        elif not getattr(instance, 'is_teacher', False):
            is_teacher = False

        if is_director:
            validated_data['is_director'] = True
            validated_data['is_teacher'] = False
            validated_data['is_parent'] = False
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = True
            return

        if is_teacher:
            validated_data['is_director'] = False
            validated_data['is_teacher'] = True
            validated_data['is_parent'] = False
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = False
            return

        validated_data['is_director'] = False
        validated_data['is_teacher'] = False
        validated_data['is_parent'] = True
        validated_data['is_staff'] = False
        validated_data['is_superuser'] = False

    def create(self, validated_data):
        # Wyciągamy hasło, żeby je zahaszować
        password = validated_data.pop('password', None)
        password_generated = validated_data.pop('password_generated', False)
        self._normalize_role_flags(validated_data)
        user = User(**validated_data)
        
        if password:
            user.set_password(password)
            if user.is_teacher:
                user.director_password_preview = password
                user.director_password_preview_active = True
            elif password_generated:
                user.director_password_preview = password
                user.director_password_preview_active = True
            else:
                user.director_password_preview = None
                user.director_password_preview_active = False
        else:
            user.set_unusable_password() # Jeśli nie podano hasła
            user.director_password_preview = None
            user.director_password_preview_active = False
            
        user.save()
        return user

    def update(self, instance, validated_data):
        # Przy edycji też musimy uważać na hasło
        password = validated_data.pop('password', None)
        password_generated = validated_data.pop('password_generated', False)
        self._normalize_role_flags(validated_data, instance=instance)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if password:
            instance.set_password(password)
            if instance.is_teacher:
                instance.director_password_preview = password
                instance.director_password_preview_active = True
            elif password_generated:
                instance.director_password_preview = password
                instance.director_password_preview_active = True
            else:
                instance.director_password_preview = None
                instance.director_password_preview_active = False

        if instance.is_teacher and instance.director_password_preview and not instance.director_password_preview_active:
            instance.director_password_preview_active = True
            
        instance.save()
        return instance