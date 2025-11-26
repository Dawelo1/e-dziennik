from django.contrib import admin
from django import forms
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

class ChildAdminForm(forms.ModelForm):
    class Meta:
        model = Child
        fields = '__all__'

    def clean_parents(self):
        """
        Ta funkcja sprawdza pole 'parents' podczas zapisywania w panelu admina.
        """
        parents = self.cleaned_data['parents']
        count = parents.count()

        if count < 1:
            raise forms.ValidationError("Dziecko musi mieć przypisanego przynajmniej 1 rodzica.")
        
        if count > 2:
            raise forms.ValidationError(f"Wybrano {count} rodziców. Dziecko może mieć maksymalnie 2 rodziców.")
        
        return parents

# Konfiguracja wyświetlania Dzieci
class ChildAdmin(admin.ModelAdmin):
    form = ChildAdminForm  # Podpinamy nasz formularz z walidacją
    
    # Dodajemy 'get_parents_names' do listy kolumn
    list_display = ('first_name', 'last_name', 'group', 'get_parents_names')
    
    list_filter = ('group',)
    search_fields = ('last_name', 'first_name')
    filter_horizontal = ('parents',) # Wygodne okienko do wybierania rodziców

    # Optymalizacja zapytania do bazy (żeby nie muliło przy dużej liście)
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related('parents')

    # 3. FUNKCJA WYŚWIETLAJĄCA RODZICÓW W KOLUMNIE
    def get_parents_names(self, obj):
        # Pobieramy wszystkich rodziców i łączymy ich imiona przecinkiem
        # Używamy get_full_name() (Imię Nazwisko) lub username jeśli brak imienia
        parents_list = [p.get_full_name() or p.username for p in obj.parents.all()]
        return ", ".join(parents_list)
    
    # Nadajemy ładną nazwę kolumnie
    get_parents_names.short_description = 'Rodzice'

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