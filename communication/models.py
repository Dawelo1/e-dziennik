from django.db import models
from users.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from users.email_notifications import queue_parent_email_notification
from users.models import EmailNotificationEventType

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages', verbose_name="Nadawca")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages', verbose_name="Odbiorca")
    subject = models.CharField(max_length=200, verbose_name="Temat")
    body = models.TextField(verbose_name="Treść wiadomości")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data wysłania")
    is_read = models.BooleanField(default=False, verbose_name="Przeczytana")

    class Meta:
        ordering = ['-created_at'] # Najnowsze na górze
        verbose_name = "Wiadomość"
        verbose_name_plural = "Wiadomości"

    def __str__(self):
        return f"Od: {self.sender} | Do: {self.receiver} | {self.subject}"

# --- SYGNAŁ (Automatyczny E-mail) ---
@receiver(post_save, sender=Message)
def send_email_notification(sender, instance, created, **kwargs):
    """
    Kiedy w bazie powstaje nowa wiadomość (created=True),
    Django wysyła prawdziwy e-mail do odbiorcy.
    """
    if not created:
        return

    # E-mail o nowych wiadomościach wysyłamy tylko do rodzica (nie do dyrektora).
    queue_parent_email_notification(instance.receiver, EmailNotificationEventType.MESSAGES)