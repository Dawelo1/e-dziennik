from django.db import models
from users.models import User
from django_cryptography.fields import encrypt # Szyfrowanie RODO
from django.utils import timezone

class Group(models.Model):
    name = models.CharField(max_length=100, verbose_name="Nazwa Grupy")
    teachers_info = models.TextField(help_text="Imiona i nazwiska nauczycieli", verbose_name="Informacje o nauczycielach")

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
        ('nieobecny', 'Nieobecny (Zgłoszone)'),
        # Opcjonalnie 'present' jeśli dyrektor chce ręcznie potwierdzić, ale domyślnie brak wpisu = obecny
    ]
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='attendance', verbose_name="Dziecko")
    date = models.DateField(verbose_name="Data nieobecności")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='nieobecny')
    
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
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Kwota")
    description = models.CharField(max_length=200, verbose_name="Opis") # np. "Czesne Styczeń"
    is_paid = models.BooleanField(default=False, verbose_name="Opłacone")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data utworzenia")
    payment_title = models.CharField(max_length=100, unique=True, blank=True, verbose_name="Tytuł płatności (generowany automatycznie/ zostawić pusty)")

    def save(self, *args, **kwargs):
        if not self.payment_title:
            self.payment_title = self.generate_unique_title()
        super().save(*args, **kwargs)

    def generate_unique_title(self):
        # Format: Imię(1)Nazwisko(1)/DDMMYYYY/XXX
        # XXX to unikalny kod dnia
        first = self.child.first_name[0].upper()
        last = self.child.last_name[0].upper()
        today = datetime.date.today()
        date_str = today.strftime("%d%m%y")
        
        # Licznik dla dzisiejszych płatności
        count = Payment.objects.filter(created_at__date=today).count() + 1
        unique_code = f"{count:03d}" # np. 001, 002

        return f"{first}{last}/{date_str}/{unique_code}"
    
    class Meta:
        verbose_name = "Płatność"
        verbose_name_plural = "Płatności"

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
    date = models.DateField(unique=True, verbose_name="Data")
    
    # 1. ŚNIADANIE (Podział analogiczny do obiadu)
    breakfast_soup = models.CharField(max_length=200, verbose_name="Zupa / Zupa mleczna", blank=True, null=True)
    breakfast_main_course = models.TextField(verbose_name="Drugie danie / Kanapki", blank=True, null=True)
    breakfast_beverage = models.CharField(max_length=100, verbose_name="Napój", blank=True, null=True)
    breakfast_fruit = models.CharField(max_length=100, verbose_name="Owoc / Dodatek", blank=True, null=True)
    
    # 2. OBIAD (Zmienione nazwy - bez prefiksu "Obiad:")
    lunch_soup = models.CharField(max_length=200, verbose_name="Zupa", blank=True, null=True)
    lunch_main_course = models.TextField(verbose_name="Drugie danie", blank=True, null=True)
    lunch_beverage = models.CharField(max_length=100, verbose_name="Napój", blank=True, null=True)
    lunch_fruit = models.CharField(max_length=100, verbose_name="Owoc / Deser", blank=True, null=True)
    
    # 3. PODWIECZOREK
    fruit_break = models.TextField(verbose_name="Podwieczorek / Owoce", blank=True)
    
    allergens = models.CharField(max_length=200, verbose_name="Alergeny (numery)", blank=True, help_text="np. 1, 3, 7")

    class Meta:
        verbose_name = "Jadłospis dzienny"
        verbose_name_plural = "Jadłospis"
        ordering = ['-date']

    def __str__(self):
        return f"Jadłospis: {self.date}"
    
class PostComment(models.Model):
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField(verbose_name="Treść komentarza")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at'] # Najstarsze na górze (jak czat)
        verbose_name = "Komentarz"
        verbose_name_plural = "Komentarze"

    def __str__(self):
        return f"{self.author.username}: {self.content[:20]}"