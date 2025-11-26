from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group
from .models import User
from django.contrib import messages
from .forms import CustomUserCreationForm, CustomUserChangeForm 

# Rejestrujemy nasz customowy model użytkownika
# Używamy UserAdmin, żeby zachować ładny wygląd zarządzania hasłami itp.

class CustomUserAdmin(UserAdmin):
    # Podmieniamy formularz dodawania na nasz własny
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    
    # Definiujemy, jakie pola mają się wyświetlać w formularzu dodawania (kolejność)
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'auto_generate', # Nasz checkbox na górze
                'role',        # Wybór roli
                'first_name', 'last_name', 'email', 'phone_number',
                'username', 
                'password_1', 'password_2'
            ),
        }),
    )

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Informacje osobiste', {
            'fields': (
                'first_name', 'last_name', 
                'email', 'phone_number', 
                'role' # <--- Dodajemy nasze pole wyboru roli
            )
        }),
        ('Uprawnienia (Techniczne)', {
            'classes': ('collapse',), # Zwijamy to, bo rola 'Dyrektor' ustawia to automatycznie
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Ważne daty', {'fields': ('last_login', 'date_joined')}),
    )

    # Lista kolumn w widoku wszystkich użytkowników (też warto dodać telefon i imiona)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_director', 'is_parent', 'phone_number')

    # --- MAGIA KOMUNIKATÓW ---
    def response_add(self, request, obj, post_url_continue=None):
        """
        Ta metoda wywołuje się PO dodaniu użytkownika.
        Sprawdzamy, czy formularz wygenerował hasło i wyświetlamy je Dyrektorowi.
        """
        # Pobieramy hasło, które zapisał formularz w zmiennej tymczasowej (patrz forms.py)
        # Ponieważ response_add nie ma bezpośredniego dostępu do instancji formularza w łatwy sposób,
        # musimy "oszukać" system i sprawdzić, czy hasło w obiekcie usera zgadza się z logiką automatu.
        # Ale prościej: 
        # Zmodyfikujmy komunikat sukcesu.
        
        return super().response_add(request, obj, post_url_continue)

    def save_model(self, request, obj, form, change):
        """
        Nadpisujemy zapisywanie, żeby przechwycić wygenerowane hasło i pokazać komunikat.
        """
        super().save_model(request, obj, form, change)
        
        # Jeśli formularz miał wygenerowane hasło (nasze pole dodane w forms.py)
        if hasattr(form, 'generated_password_display'):
            password = form.generated_password_display
            username = obj.username
            
            # Wyświetlamy żółty/zielony pasek na górze ekranu z danymi
            messages.add_message(
                request, 
                messages.INFO, 
                f"✅ SUKCES! Utworzono konto automatycznie.\n\n"
                f"LOGIN: {username}\n"
                f"HASŁO: {password}\n\n"
                f"Skopiuj te dane i przekaż rodzicowi, ponieważ hasło jest teraz zaszyfrowane i nie zobaczysz go ponownie!"
            )

admin.site.register(User, CustomUserAdmin)

try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass