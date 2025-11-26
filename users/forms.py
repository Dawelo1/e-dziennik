# users/forms.py
from django import forms
from django.contrib.auth import get_user_model
from .utils import generate_unique_username, generate_secure_password

User = get_user_model()

class CustomUserCreationForm(forms.ModelForm):
    # 1. ZMIANA: Domyślnie zaznaczony automat (initial=True)
    auto_generate = forms.BooleanField(
        required=False, 
        initial=True, 
        label="Wygeneruj dane automatycznie",
        help_text="Zaznacz, aby system sam stworzył login (pXXXXXm) i bezpieczne hasło."
    )

    # 2. NOWOŚĆ: Wybór roli (Zamiast checkboxa is_parent)
    ROLE_CHOICES = [
        ('parent', 'Rodzic (Domyślnie)'),
        ('director', 'Dyrektor / Administrator'),
    ]
    role = forms.ChoiceField(
        choices=ROLE_CHOICES,
        initial='parent',
        widget=forms.RadioSelect, # Wyświetli ładne kropki do wyboru
        label="Rola użytkownika"
    )
    
    # Pola na hasło
    password_1 = forms.CharField(
        label="Hasło", 
        widget=forms.PasswordInput, 
        required=False,
        help_text="Zostaw puste, jeśli zaznaczyłeś opcję automatyczną."
    )
    password_2 = forms.CharField(
        label="Potwierdź hasło", 
        widget=forms.PasswordInput, 
        required=False
    )

    class Meta:
        model = User
        # Usuwamy 'is_parent' stąd, bo obsłużymy to przez pole 'role'
        fields = ('first_name', 'last_name', 'email', 'phone_number', 'username')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Oszukujemy formularz, że username nie jest wymagane (bo automat je wypełni)
        self.fields['username'].required = False

    def clean(self):
        cleaned_data = super().clean()
        auto_generate = cleaned_data.get("auto_generate")
        username = cleaned_data.get("username")
        pass1 = cleaned_data.get("password_1")
        pass2 = cleaned_data.get("password_2")

        if auto_generate:
            # SCENARIUSZ AUTOMATYCZNY
            new_username = generate_unique_username()
            cleaned_data['username'] = new_username
            
            generated_pass = generate_secure_password()
            self.generated_password_display = generated_pass
            cleaned_data['password'] = generated_pass
            
            # Usuwamy błędy walidacji dla username (bo je właśnie wypełniliśmy)
            if 'username' in self.errors:
                del self.errors['username']
        else:
            # SCENARIUSZ RĘCZNY
            if not username:
                self.add_error('username', 'Podaj nazwę użytkownika lub zaznacz generowanie automatyczne.')
            
            if not pass1:
                self.add_error('password_1', 'Podaj hasło lub zaznacz generowanie automatyczne.')
            elif pass1 != pass2:
                self.add_error('password_2', 'Hasła nie są takie same.')
            
            if pass1:
                cleaned_data['password'] = pass1

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        
        # Obsługa hasła
        if "password" in self.cleaned_data:
            user.set_password(self.cleaned_data["password"])
            
        # Obsługa loginu (z automatu)
        if "username" in self.cleaned_data:
            user.username = self.cleaned_data["username"]

        # 3. NOWOŚĆ: Przypisanie roli na podstawie wyboru (Radio Button)
        role = self.cleaned_data.get('role')
        if role == 'director':
            user.is_director = True
            user.is_parent = False
            user.is_staff = True      # Dajemy dostęp do panelu admina
            user.is_superuser = True  # Dajemy pełne prawa (opcjonalnie, zależnie jak chcesz)
        else:
            user.is_director = False
            user.is_parent = True
            user.is_staff = False
            user.is_superuser = False

        if commit:
            user.save()
        return user