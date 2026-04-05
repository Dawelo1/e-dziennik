from django.contrib.auth.models import AbstractUser
from django.db import models


class EmailNotificationEventType(models.TextChoices):
    POSTS = 'posts', 'Posty'
    MESSAGES = 'messages', 'Wiadomości'
    GALLERY = 'gallery', 'Galeria'
    PAYMENTS = 'payments', 'Płatności'
    SCHEDULE = 'schedule', 'Plan zajęć'
    CALENDAR = 'calendar', 'Kalendarz'

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

    is_teacher = models.BooleanField(
        default=False,
        verbose_name="Nauczyciel"
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
        constraints = [
            models.UniqueConstraint(
                fields=['is_teacher'],
                condition=models.Q(is_teacher=True),
                name='users_single_teacher',
            ),
        ]

    def __str__(self):
        # Wyświetlamy ładnie imię i nazwisko lub nazwę użytkownika
        if self.is_director:
            role = "Dyrektor"
        elif self.is_teacher:
            role = "Nauczyciel"
        else:
            role = "Rodzic"
        name = f"{self.first_name} {self.last_name}" if self.first_name else self.username
        return f"{name} ({role})"


class ParentEmailNotificationSettings(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='email_notification_settings',
        verbose_name='Rodzic',
    )
    posts_enabled = models.BooleanField(default=False, verbose_name='E-mail: posty')
    messages_enabled = models.BooleanField(default=True, verbose_name='E-mail: wiadomości')
    gallery_enabled = models.BooleanField(default=False, verbose_name='E-mail: galeria')
    payments_enabled = models.BooleanField(default=True, verbose_name='E-mail: płatności')
    schedule_enabled = models.BooleanField(default=False, verbose_name='E-mail: plan zajęć')
    calendar_enabled = models.BooleanField(default=False, verbose_name='E-mail: kalendarz')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ustawienia e-mail powiadomień rodzica'
        verbose_name_plural = 'Ustawienia e-mail powiadomień rodziców'

    def __str__(self):
        return f'Ustawienia e-mail: {self.user.username}'


class ParentEmailNotificationState(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='email_notification_states',
        verbose_name='Rodzic',
    )
    event_type = models.CharField(
        max_length=20,
        choices=EmailNotificationEventType.choices,
        verbose_name='Typ zdarzenia',
    )
    last_sent_on = models.DateField(null=True, blank=True, verbose_name='Ostatni dzień wysyłki')
    pending_count = models.PositiveIntegerField(default=0, verbose_name='Liczba oczekujących zdarzeń')
    pending_send_at = models.DateTimeField(null=True, blank=True, verbose_name='Wyślij nie wcześniej niż')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Stan e-mail powiadomień rodzica'
        verbose_name_plural = 'Stany e-mail powiadomień rodziców'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'event_type'],
                name='users_parent_email_notification_state_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['pending_send_at'], name='users_email_pending_at_idx'),
            models.Index(fields=['event_type'], name='users_email_event_type_idx'),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.event_type}'