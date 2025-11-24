from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    is_director = models.BooleanField(default=False)
    is_parent = models.BooleanField(default=False)
    
    # Wymagane pola kontaktowe
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    class Meta:
        verbose_name = "Użytkownik"
        verbose_name_plural = "Użytkownicy"

    def __str__(self):
        return f"{self.username} ({'Dyrektor' if self.is_director else 'Rodzic'})"
    

