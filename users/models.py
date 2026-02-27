from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    is_director = models.BooleanField(
        default=False, 
        verbose_name="Dyrektor"       # <--- Spolszczenie
    )
    
    # Tu zmieniamy default na True, żeby checkbox był zaznaczony automatycznie
    is_parent = models.BooleanField(
        default=True,                 # <--- Automatycznie zaznaczone jako Rodzic
        verbose_name="Rodzic"         # <--- Spolszczenie
    )
    
    phone_number = models.CharField(
        max_length=15, 
        blank=True, 
        null=True, 
        verbose_name="Numer telefonu" # <--- Spolszczenie
    )

    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name="Zdjęcie profilowe")

    director_password_preview = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        verbose_name="Podgląd hasła dla dyrektora"
    )

    director_password_preview_active = models.BooleanField(
        default=False,
        verbose_name="Podgląd hasła aktywny"
    )

    last_seen_schedule_activity_id = models.PositiveIntegerField(
        default=0,
        verbose_name="Ostatnio widziane zajęcia (ID)"
    )
    last_seen_gallery_item_id = models.PositiveIntegerField(
        default=0,
        verbose_name="Ostatnio widziana galeria (ID)"
    )
    last_seen_calendar_closure_id = models.PositiveIntegerField(
        default=0,
        verbose_name="Ostatnio widziany kalendarz (ID)"
    )
    last_seen_payment_id = models.PositiveIntegerField(
        default=0,
        verbose_name="Ostatnio widziane płatności (ID)"
    )

    class Meta:
        verbose_name = "Użytkownik"
        verbose_name_plural = "Użytkownicy"

    def __str__(self):
        # Wyświetlamy ładnie imię i nazwisko lub nazwę użytkownika
        role = "Dyrektor" if self.is_director else "Rodzic"
        name = f"{self.first_name} {self.last_name}" if self.first_name else self.username
        return f"{name} ({role})"