from django.core.mail import send_mail
from django.dispatch import receiver
from django.urls import reverse
from django_rest_passwordreset.signals import reset_password_token_created
from django.conf import settings
from django.db.models.signals import post_delete, pre_save
from rest_framework.authtoken.models import Token
from django.core.cache import cache
from .models import User

@receiver(reset_password_token_created)
def password_reset_token_created(sender, instance, reset_password_token, *args, **kwargs):
    """
    Wysyła e-mail z tokenem do resetu hasła.
    """
    
    # Tutaj wpisz adres Twojej aplikacji REACT (Frontend)
    # Na razie lokalnie, potem zmienisz na domenę np. przedszkole.pl
    frontend_url = "http://localhost:5173/reset-hasla" 
    
    # Tworzymy link: http://localhost:5173/reset-hasla?token=12345abcd...
    reset_url = f"{frontend_url}?token={reset_password_token.key}"

    # Treść wiadomości
    email_plaintext_message = f"""
    Cześć {reset_password_token.user.username},
    
    Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Przedszkolu.
    Aby ustawić nowe hasło, kliknij w poniższy link:
    
    {reset_url}
    
    Jeśli to nie Ty prosiłeś o reset, zignoruj tę wiadomość.
    """

    send_mail(
        # Tytuł:
        "Reset hasła - Przedszkole",
        # Treść:
        email_plaintext_message,
        # Od kogo:
        "noreply@przedszkole.pl",
        # Do kogo:
        [reset_password_token.user.email],
        fail_silently=False,
    )

@receiver(post_delete, sender=Token)
def on_token_delete(sender, instance, **kwargs):
    """
    Uruchamia się AUTOMATYCZNIE, gdy token znika z bazy danych.
    Czyści status 'online' dla danego użytkownika.
    """
    user = instance.user
    if user.is_director:
        cache_key = f'director_online_{user.id}'
        cache.delete(cache_key)
        print(f"🧹 [SIGNAL] Usunięto status online dla: {user.username}")

# 1. Usuń plik, gdy użytkownik jest usuwany z bazy
@receiver(post_delete, sender=User)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.avatar:
        instance.avatar.delete(save=False)

# 2. Usuń STARY plik, gdy wgrywany jest NOWY (lub avatara usunięto)
@receiver(pre_save, sender=User)
def auto_delete_file_on_change(sender, instance, **kwargs):
    if not instance.pk:
        return False

    try:
        old_avatar = User.objects.get(pk=instance.pk).avatar
    except User.DoesNotExist:
        return False

    new_avatar = instance.avatar
    
    # Jeśli stare zdjęcie istnieje, a nowe jest inne (lub go nie ma) -> usuń stare
    if old_avatar and old_avatar != new_avatar:
        old_avatar.delete(save=False)