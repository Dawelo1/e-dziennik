from django.db import models
from users.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    subject = models.CharField(max_length=200)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

# Sygnał: Wysyłka maila po zapisaniu nowej wiadomości w bazie
@receiver(post_save, sender=Message)
def send_email_notification(sender, instance, created, **kwargs):
    if created:
        send_mail(
            subject=f"Nowa wiadomość: {instance.subject}",
            message=f"Masz nową wiadomość od {instance.sender}.\nZaloguj się, aby przeczytać.",
            from_email='przedszkole@system.pl',
            recipient_list=[instance.receiver.email],
            fail_silently=True,
        )