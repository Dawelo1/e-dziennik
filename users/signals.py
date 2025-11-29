from django.core.mail import send_mail
from django.dispatch import receiver
from django.urls import reverse
from django_rest_passwordreset.signals import reset_password_token_created
from django.conf import settings

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