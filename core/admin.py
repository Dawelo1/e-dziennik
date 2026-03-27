from django.contrib import admin
from django import forms
from .models import Group, Child, Payment, Post, Attendance, FacilityClosure, SpecialActivity, DailyMenu, PostComment, RecurringPayment, GalleryItem, GalleryImage, Preschool


# Prosta rejestracja - pozwoli dodawać/edytować elementy
admin.site.register(Group)
admin.site.register(PostComment)

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
    list_display = ('first_name', 'last_name', 'group', 'uses_meals', 'get_parents_names')
    
    list_filter = ('group', 'uses_meals')
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

class SpecialActivityAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'start_time', 'get_groups')
    list_filter = ('date', 'groups')
    filter_horizontal = ('groups',) # Wygodne okienko do wybierania grup
    
    def get_groups(self, obj):
        return ", ".join([g.name for g in obj.groups.all()])
    get_groups.short_description = "Dla grup"

admin.site.register(FacilityClosure)
admin.site.register(SpecialActivity, SpecialActivityAdmin)

class DailyMenuAdmin(admin.ModelAdmin):
    list_display = ('week_start_date', 'week_end_date', 'image')
    list_filter = ('week_start_date',)
    date_hierarchy = 'week_start_date'
    fields = ('week_start_date', 'week_end_date_display', 'image')
    readonly_fields = ('week_end_date_display',)

    def week_end_date_display(self, obj):
        if not obj or not obj.week_start_date:
            return '-'
        return obj.week_end_date
    week_end_date_display.short_description = 'Data zakończenia tygodnia'

admin.site.register(DailyMenu, DailyMenuAdmin)

class RecurringPaymentAdmin(admin.ModelAdmin):
    list_display = ('children_list', 'description', 'amount', 'frequency', 'next_payment_date', 'is_active')
    list_filter = ('is_active', 'frequency', 'next_payment_date')
    search_fields = ('children__last_name', 'description')
    list_editable = ('is_active', 'next_payment_date') # Szybka edycja daty i włączania/wyłączania

    def children_list(self, obj):
        return ', '.join(str(child) for child in obj.children.all())

    children_list.short_description = 'Dzieci'

admin.site.register(RecurringPayment, RecurringPaymentAdmin)

# To pozwala dodawać zdjęcia BEZPOŚREDNIO w widoku Albumu
class GalleryImageInline(admin.TabularInline):
    model = GalleryImage
    extra = 5 # Pokaże od razu 5 pustych miejsc na zdjęcia (można dodać więcej plusem)

class GalleryItemAdmin(admin.ModelAdmin):
    # Wyświetlamy autora w liście albumów
    list_display = ('title', 'created_at', 'target_group', 'author')
    
    # Podpinamy inline do wgrywania wielu zdjęć
    inlines = [GalleryImageInline] 
    
    # --- ZMIANY TUTAJ ---
    
    # 1. Ukrywamy pole 'author' w formularzu edycji/dodawania
    exclude = ('author',)

    # 2. Automatycznie przypisujemy autora przy zapisywaniu NOWEGO albumu
    def save_model(self, request, obj, form, change):
        # 'change' jest True przy edycji, a False przy tworzeniu
        # Ustawiamy autora tylko przy tworzeniu (if not change)
        if not change:
            obj.author = request.user
            
        super().save_model(request, obj, form, change)

# Rejestracja w panelu
admin.site.register(GalleryItem, GalleryItemAdmin)

class PreschoolAdmin(admin.ModelAdmin):
    verbose_name = "Dane przedszkola"
    verbose_name_plural = "Dane przedszkola"
    list_display = (
        'city', 'street', 'postal_code', 'opening_time_from', 'opening_time_to',
        'phone_number', 'email', 'bank_account_number', 'bank_name', 'get_directors'
    )

    def get_directors(self, obj):
        if not obj.directors:
            return ""
        return ", ".join(obj.directors)
    get_directors.short_description = "Dyrekcja"

admin.site.register(Preschool, PreschoolAdmin)