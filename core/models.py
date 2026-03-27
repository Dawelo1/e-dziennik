from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from users.models import User
from django_cryptography.fields import encrypt # Szyfrowanie RODO
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from PIL import Image
import os


# Model przechowujący informacje o przedszkolu
class Preschool(models.Model):
    opening_time_from = models.TimeField(verbose_name="Godzina otwarcia (od)")
    opening_time_to = models.TimeField(verbose_name="Godzina zamknięcia (do)")
    phone_number = models.CharField(max_length=32, verbose_name="Numer telefonu")
    email = models.EmailField(verbose_name="Adres email")
    street = models.CharField(max_length=128, verbose_name="Ulica")
    postal_code = models.CharField(max_length=16, verbose_name="Kod pocztowy")
    city = models.CharField(max_length=64, verbose_name="Miejscowość")
    bank_account_number = models.CharField(max_length=64, verbose_name="Numer konta bankowego")
    bank_name = models.CharField(max_length=128, verbose_name="Nazwa banku", blank=True)
    directors = models.JSONField(verbose_name="Imiona i nazwiska dyrekcji (lista)")

    def clean(self):
        super().clean()
        if self.directors and len(self.directors) > 10:
            from django.core.exceptions import ValidationError
            raise ValidationError({
                'directors': 'Możesz dodać maksymalnie 10 dyrektorów.'
            })

    class Meta:
        verbose_name = "Dane przedszkola"
        verbose_name_plural = "Dane przedszkola"

    def __str__(self):
        return f"Przedszkole: {self.city}, {self.street}"

class Group(models.Model):
    GROUP_COLOR_CHOICES = [
        ('red', 'Czerwony'),
        ('yellow', 'Żółty'),
        ('blue', 'Niebieski'),
        ('green', 'Zielony'),
        ('orange', 'Pomarańczowy'),
        ('purple', 'Fioletowy'),
    ]

    name = models.CharField(max_length=100, verbose_name="Nazwa Grupy")
    teachers_info = models.TextField(help_text="Imiona i nazwiska nauczycieli", verbose_name="Informacje o nauczycielach")
    color_key = models.CharField(
        max_length=20,
        choices=GROUP_COLOR_CHOICES,
        null=True,
        blank=True,
        editable=False,
        verbose_name="Kolor grupy"
    )

    @classmethod
    def color_pool(cls):
        return [key for key, _ in cls.GROUP_COLOR_CHOICES]

    @classmethod
    def first_available_color(cls):
        used_colors = set(
            cls.objects.exclude(color_key__isnull=True)
            .exclude(color_key='')
            .values_list('color_key', flat=True)
        )
        for color_key in cls.color_pool():
            if color_key not in used_colors:
                return color_key
        return None

    def save(self, *args, **kwargs):
        if self._state.adding and Group.objects.count() >= len(self.color_pool()):
            raise ValidationError('Maksymalna liczba grup to 6. Usuń jedną z istniejących grup, aby dodać nową.')

        if not self.color_key:
            available_color = self.first_available_color()
            if available_color is None:
                raise ValidationError('Brak wolnych kolorów grup. Maksymalna liczba grup to 6.')
            self.color_key = available_color
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Grupa"
        verbose_name_plural = "Grupy"

    def __str__(self):
        return self.name

class Child(models.Model):
    parents = models.ManyToManyField(User, related_name='child',verbose_name="Konto Rodzica")
    group = models.ForeignKey(Group, on_delete=models.PROTECT, related_name='children', verbose_name="Grupa" )
    first_name = models.CharField(max_length=50, verbose_name="Imię" )
    last_name = models.CharField(max_length=50, verbose_name="Nazwisko" )
    date_of_birth = models.DateField(verbose_name="Data urodzenia" )
    meal_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=20.00, 
        verbose_name="Stawka żywieniowa"
    )
    uses_meals = models.BooleanField(
        default=False,
        verbose_name="Korzysta z posiłków"
    )
    meal_start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Data rozpoczęcia wyżywienia"
    )
    
    # Dane wrażliwe (RODO) - szyfrowane w bazie
    medical_info = encrypt(models.TextField(blank=True, help_text="Alergie, uwagi zdrowotne", verbose_name="Informacje medyczne"))
    
    class Meta:
        verbose_name = "Dziecko"
        verbose_name_plural = "Dzieci"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
class Attendance(models.Model):
    STATUS_CHOICES = [
        # Zmieniamy logikę: rekord w bazie = zgłoszona nieobecność
        ('absent', 'Nieobecny (Zgłoszone)'),
        # Opcjonalnie 'present' jeśli dyrektor chce ręcznie potwierdzić, ale domyślnie brak wpisu = obecny
    ]
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='attendance', verbose_name="Dziecko")
    date = models.DateField(verbose_name="Data nieobecności")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent')
    
    # To pole spełnia Twoje wymaganie: "data kiedy to zostało wpisane do bazy"
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data zgłoszenia")

    class Meta:
        unique_together = ('child', 'date')
        ordering = ['-date']
        verbose_name = "Obecność"
        verbose_name_plural = "Obecności"

    def __str__(self):
        return f"{self.child} - {self.date} ({self.status})"

import datetime

class Payment(models.Model):
    child = models.ForeignKey(Child, on_delete=models.CASCADE, verbose_name="Dziecko")
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name="Kwota"
    )
    description = models.CharField(max_length=200, verbose_name="Opis") # np. "Czesne Styczeń"
    is_paid = models.BooleanField(default=False, verbose_name="Opłacone")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data utworzenia")
    payment_title = models.CharField(max_length=100, unique=True, blank=True, verbose_name="Tytuł płatności (generowany automatycznie/ zostawić pusty)")
    payment_date = models.DateTimeField(null=True, blank=True, verbose_name="Data opłacenia")
    meal_period = models.DateField(
        null=True,
        blank=True,
        verbose_name="Okres rozliczeniowy wyżywienia (1. dzień miesiąca)"
    )

    def save(self, *args, **kwargs):
        if not self.payment_title:
            self.payment_title = self.generate_unique_title()
        # 2. NOWOŚĆ: Automatyczne ustawienie daty zapłaty
        # Jeśli zaznaczono is_paid=True, a nie ma daty -> wpisz "teraz"
        if self.is_paid and not self.payment_date:
            self.payment_date = timezone.now()
        # Jeśli odznaczono is_paid (korekta) -> usuń datę
        elif not self.is_paid:
            self.payment_date = None
        super().save(*args, **kwargs)

    def generate_unique_title(self):
        # Format: Imie/Nazwisko/MMRRRR/CCC
        first_name = self.child.first_name
        last_name = self.child.last_name

        today = datetime.date.today()
        date_str = today.strftime("%m%Y")  # Format MMRRRR (np. 122025)
        prefix = f"{first_name}/{last_name}/{date_str}/"

        # Zamiast count()+1 (które po usunięciu rekordów może dać duplikat),
        # znajdujemy najwyższy istniejący numer sekwencji dla danego prefiksu.
        existing_titles = Payment.objects.filter(
            payment_title__startswith=prefix
        ).values_list('payment_title', flat=True)

        max_code = 0
        for title in existing_titles:
            suffix = title.rsplit('/', 1)[-1]
            if suffix.isdigit():
                max_code = max(max_code, int(suffix))

        next_code = max_code + 1
        candidate = f"{prefix}{next_code:03d}"

        while Payment.objects.filter(payment_title=candidate).exists():
            next_code += 1
            candidate = f"{prefix}{next_code:03d}"

        return candidate
    
    class Meta:
        verbose_name = "Płatność"
        verbose_name_plural = "Płatności"
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gte=0), name='payment_amount_gte_0'),
            models.UniqueConstraint(
                fields=['child', 'meal_period'],
                condition=models.Q(meal_period__isnull=False),
                name='unique_meal_payment_per_child_period',
            ),
        ]

    def __str__(self):
        return f"{self.child} - {self.description} ({self.amount} zł)"

class Post(models.Model):
    # Tytuł wpisu, np. "Wizyta Świętego Mikołaja"
    title = models.CharField(max_length=200, verbose_name="Tytuł")
    
    # Treść posta (opcjonalna), np. "Było super, dzieci dostały prezenty."
    content = models.TextField(blank=True, verbose_name="Treść")
    
    # ZDJĘCIE - to jest kluczowe dla "Tablicy"
    image = models.ImageField(
        upload_to='gallery/%Y/%m/', # Zapisze np. w media/gallery/2023/11/
        blank=True, 
        null=True,
        verbose_name="Zdjęcie"
    )

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        
        if self.image:
            img = Image.open(self.image.path)
            if img.height > 1200 or img.width > 1200:
                output_size = (1200, 1200)
                img.thumbnail(output_size)
                img.save(self.image.path, quality=80, optimize=True)
    
    # Data dodania - automatycznie ustawi się "teraz"
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data publikacji")
    likes = models.ManyToManyField(User, related_name='liked_posts', blank=True)
    
    # Opcjonalnie: Widoczność dla konkretnej grupy.
    # Jeśli puste (null) -> widzą wszyscy (ogłoszenie ogólnoprzedszkolne).
    # Jeśli wybrano grupę -> widzą tylko rodzice z tej grupy.
    target_group = models.ForeignKey(
        'Group', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='posts',
        verbose_name="Dla grupy (puste = dla wszystkich)"
    )

    class Meta:
        ordering = ['-created_at'] # Najnowsze posty na górze (jak na FB)
        verbose_name = "Wpis/Aktualność"
        verbose_name_plural = "Tablica Aktualności"

    def __str__(self):
        return f"{self.title} ({self.created_at.date()})"
    
class FacilityClosure(models.Model):
    """
    Dni, w które przedszkole jest zamknięte (np. Święta, Wigilia, Remont).
    Dyrektor dodaje te dni na początku roku.
    """
    date = models.DateField(unique=True, verbose_name="Data zamknięcia")
    reason = models.CharField(max_length=200, verbose_name="Powód", blank=True, help_text="np. Przerwa świąteczna")

    class Meta:
        verbose_name = "Dzień wolny"
        verbose_name_plural = "Dni wolne od zajęć"
        ordering = ['date']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        Attendance.objects.filter(date=self.date).delete()

    def __str__(self):
        return f"{self.date} - {self.reason}"

class SpecialActivity(models.Model):
    """
    Zajęcia niestandardowe (Wycieczka, Kino, Teatrzyk).
    Domyślnie zajęcia są stałe, tu wpisujemy tylko wyjątki/atrakcje.
    """
    title = models.CharField(max_length=200, verbose_name="Nazwa zajęć")
    description = models.TextField(blank=True, verbose_name="Opis/Szczegóły")
    date = models.DateField(verbose_name="Data")
    start_time = models.TimeField(verbose_name="Godzina rozpoczęcia")
    end_time = models.TimeField(verbose_name="Godzina zakończenia", blank=True, null=True)
    
    # Przypisujemy zajęcia do grup (Wycieczka może być dla jednej grupy lub dla wszystkich)
    groups = models.ManyToManyField(
        Group, 
        related_name='special_activities', 
        verbose_name="Dla grup"
    )

    class Meta:
        verbose_name = "Zajęcia dodatkowe/Wycieczka"
        verbose_name_plural = "Plan zajęć"
        ordering = ['-date', 'start_time']

    def __str__(self):
        return f"{self.title} ({self.date})"
    
# core/models.py

class DailyMenu(models.Model):
    week_start_date = models.DateField(unique=True, verbose_name="Data rozpoczęcia tygodnia")
    image = models.ImageField(upload_to='menu/%Y/%m/', verbose_name="Zdjęcie jadłospisu", blank=True, null=True)

    class Meta:
        verbose_name = "Jadłospis (zdjęcie)"
        verbose_name_plural = "Jadłospis"
        ordering = ['-week_start_date']

    def __str__(self):
        return f"Jadłospis: {self.week_start_date} - {self.week_end_date}"

    @property
    def week_end_date(self):
        return self.week_start_date + relativedelta(days=4)
    
class PostComment(models.Model):
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    likes = models.ManyToManyField(User, related_name='liked_comments', blank=True)
    content = models.TextField(verbose_name="Treść komentarza")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at'] # Najstarsze na górze (jak czat)
        verbose_name = "Komentarz"
        verbose_name_plural = "Komentarze"

    def __str__(self):
        return f"{self.author.username}: {self.content[:20]}"
    
class RecurringPayment(models.Model):
    FREQUENCY_CHOICES = [
        ('weekly', 'Co tydzień'),
        ('monthly', 'Co miesiąc'),
        ('yearly', 'Co rok'),
    ]
    
    children = models.ManyToManyField(Child, related_name='recurring_payment_templates', verbose_name="Dzieci")
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name="Kwota"
    )
    description = models.CharField(max_length=200, verbose_name="Opis (np. Czesne)")
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='monthly', verbose_name="Częstotliwość")
    
    next_payment_date = models.DateField(verbose_name="Data następnej płatności")
    is_active = models.BooleanField(default=True, verbose_name="Aktywna")

    class Meta:
        verbose_name = "Płatność Cykliczna (Szablon)"
        verbose_name_plural = "Płatności Cykliczne"
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gte=0), name='recurring_payment_amount_gte_0'),
        ]

    def __str__(self):
        return f"{self.description} ({self.get_frequency_display()})"

    def update_next_date(self):
        """Przesuwa datę następnej płatności w zależności od częstotliwości"""
        if self.frequency == 'weekly':
            self.next_payment_date += relativedelta(weeks=1)
        elif self.frequency == 'monthly':
            self.next_payment_date += relativedelta(months=1)
        elif self.frequency == 'yearly':
            self.next_payment_date += relativedelta(years=1)
        self.save()

class GalleryItem(models.Model):
    title = models.CharField(max_length=200, verbose_name="Tytuł albumu")
    description = models.TextField(blank=True, verbose_name="Opis wydarzenia")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data dodania")
    likes = models.ManyToManyField(User, related_name='liked_galleries', blank=True)
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_gallery_items',
        verbose_name="Autor (dyrektor)",
        editable=False
    )
    
    # Podobnie jak w Postach - widoczność dla grupy lub dla wszystkich
    target_group = models.ForeignKey(
        'Group', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='gallery_items',
        verbose_name="Dla grupy (puste = dla wszystkich)"
    )

    class Meta:
        verbose_name = "Album Zdjęć"
        verbose_name_plural = "Galeria Zdjęć"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.created_at.date()})"

class GalleryImage(models.Model):
    gallery_item = models.ForeignKey(GalleryItem, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='gallery_albums/%Y/%m/', verbose_name="Zdjęcie")
    caption = models.CharField(max_length=200, blank=True, verbose_name="Podpis (opcjonalnie)")

    def __str__(self):
        return f"Zdjęcie do: {self.gallery_item.title}"

    # --- AUTOMATYCZNA KOMPRESJA ---
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs) # Najpierw zapisz oryginał

        if self.image:
            img_path = self.image.path
            
            # Otwórz zdjęcie
            img = Image.open(img_path)
            
            # Jeśli zdjęcie jest bardzo duże (szerokość lub wysokość > 1200px)
            if img.height > 1200 or img.width > 1200:
                output_size = (1200, 1200)
                img.thumbnail(output_size) # Zmniejsz zachowując proporcje
                
                # Zapisz ponownie (nadpisz) z optymalizacją
                # quality=70 znacznie zmniejsza wagę, a oko nie widzi różnicy
                img.save(img_path, quality=80, optimize=True)