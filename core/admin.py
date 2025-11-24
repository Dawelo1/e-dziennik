from django.contrib import admin
from .models import Group, Child, Payment, Post, Attendance

# Prosta rejestracja - pozwoli dodawać/edytować elementy
admin.site.register(Group)

class PaymentAdmin(admin.ModelAdmin):
    # 1. Co ma się wyświetlać w kolumnach?
    list_display = ('child', 'amount', 'description', 'payment_title', 'is_paid', 'created_at')
    
    # 2. To jest MAGIA: Pozwala edytować pole 'is_paid' bezpośrednio na liście!
    list_editable = ('is_paid',)
    
    # 3. Filtry po prawej stronie (żebyś mógł kliknąć "Pokaż tylko nieopłacone")
    list_filter = ('is_paid', 'created_at')
    
    # 4. Wyszukiwarka (szukaj po nazwisku dziecka lub tytule przelewu)
    search_fields = ('child__last_name', 'child__first_name', 'payment_title', 'description')
    
    # 5. Sortowanie (nieopłacone i najnowsze na górze)
    ordering = ('is_paid', '-created_at')

admin.site.register(Payment, PaymentAdmin)

admin.site.register(Post)

# Konfiguracja wyświetlania Dzieci
class ChildAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'group') # Co widać w kolumnach
    list_filter = ('group',) # Filtr grup po prawej stronie
    search_fields = ('last_name', 'first_name') # Pasek wyszukiwania

admin.site.register(Child, ChildAdmin)

# --- TU JEST KONFIGURACJA ATTENDANCE (OBECNOŚCI) ---
class AttendanceAdmin(admin.ModelAdmin):
    # Kolumny widoczne na liście
    list_display = ('date', 'child', 'group_name', 'status')
    
    # Filtry po prawej stronie (po dacie, statusie i grupie dziecka)
    list_filter = ('date', 'status', 'child__group')
    
    # Pozwala zmieniać status bezpośrednio na liście (szybkie odklikiwanie)
    list_editable = ('status',)
    
    # Domyślne sortowanie (najnowsze daty na górze)
    ordering = ('-date', 'child__last_name')

    # Pomocnicza metoda, żeby wyświetlić nazwę grupy (bo grupa jest w modelu Child, a nie Attendance)
    def group_name(self, obj):
        return obj.child.group.name
    group_name.short_description = 'Grupa'

admin.site.register(Attendance, AttendanceAdmin)