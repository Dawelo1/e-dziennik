from django.db import models
from users.models import User
from django_cryptography.fields import encrypt # Szyfrowanie RODO

class Group(models.Model):
    name = models.CharField(max_length=100)
    teachers_info = models.TextField(help_text="Imiona i nazwiska nauczycieli")

    def __str__(self):
        return self.name

class Child(models.Model):
    parent_account = models.OneToOneField(User, on_delete=models.CASCADE, related_name='child')
    group = models.ForeignKey(Group, on_delete=models.PROTECT, related_name='children')
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    date_of_birth = models.DateField()
    
    # Dane wrażliwe (RODO) - szyfrowane w bazie
    medical_info = encrypt(models.TextField(blank=True, help_text="Alergie, uwagi zdrowotne"))
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Obecny (Płatne)'),
        ('absent', 'Nieobecny (Odwołane)'),
    ]
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='present')

    class Meta:
        unique_together = ('child', 'date') # Jedno dziecko, jeden wpis na dzień

import datetime

class Payment(models.Model):
    child = models.ForeignKey(Child, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200) # np. "Czesne Styczeń"
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    payment_title = models.CharField(max_length=100, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.payment_title:
            self.payment_title = self.generate_unique_title()
        super().save(*args, **kwargs)

    def generate_unique_title(self):
        # Format: Imię(1)/Nazwisko(1)/DD/MM/YYYY/XXX
        # XXX to unikalny kod dnia
        first = self.child.first_name[0].upper()
        last = self.child.last_name[0].upper()
        today = datetime.date.today()
        date_str = today.strftime("%d%m%y")
        
        # Licznik dla dzisiejszych płatności
        count = Payment.objects.filter(created_at__date=today).count() + 1
        unique_code = f"{count:03d}" # np. 001, 002

        return f"{first}{last}/{date_str}/{unique_code}"
    
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