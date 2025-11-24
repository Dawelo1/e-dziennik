from django.db import models
from users.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages', verbose_name="Nadawca")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages', verbose_name="Odbiorca")
    subject = models.CharField(max_length=200, verbose_name="Temat")
    body = models.TextField(verbose_name="Treść wiadomości")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data wysłania")
    is_read = models.BooleanField(default=False, verbose_name="Przeczytana")

    class Meta:
        ordering = ['-created_at'] # Najnowsze na górze

    def __str__(self):
        return f"Od: {self.sender} | Do: {self.receiver} | {self.subject}"

# --- SYGNAŁ (Automatyczny E-mail) ---
@receiver(post_save, sender=Message)
def send_email_notification(sender, instance, created, **kwargs):
    """
    Kiedy w bazie powstaje nowa wiadomość (created=True),
    Django wysyła prawdziwy e-mail do odbiorcy.
    """
    if created:
        try:
            send_mail(
                subject=f"[Przedszkole] Nowa wiadomość: {instance.subject}",
                message=f"Dostałeś nową wiadomość od {instance.sender}.\n\nTreść:\n{instance.body}\n\nZaloguj się do aplikacji, aby odpisać.",
                from_email=settings.DEFAULT_FROM_EMAIL, # Musisz to ustawić w settings.py
                recipient_list=[instance.receiver.email], # E-mail odbiorcy z bazy userów
                fail_silently=True, # Żeby błąd maila nie wywalił aplikacji
            )
        except Exception as e:
            print(f"Błąd wysyłki maila: {e}")