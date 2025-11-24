from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group
from .models import User

# Rejestrujemy nasz customowy model użytkownika
# Używamy UserAdmin, żeby zachować ładny wygląd zarządzania hasłami itp.

# Rozszerzamy widok o nasze pola: is_director, is_parent, phone_number
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Rola w przedszkolu', {'fields': ('is_director', 'is_parent', 'phone_number')}),
    )

admin.site.register(User, CustomUserAdmin)

try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass