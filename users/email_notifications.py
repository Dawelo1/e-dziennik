import logging
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import (
    EmailNotificationEventType,
    ParentEmailNotificationSettings,
    ParentEmailNotificationState,
)

EVENT_MESSAGES = {
    EmailNotificationEventType.POSTS: {
        'subject': 'Nowe ogłoszenie - Przedszkole Pszczolka Maja',
        'body': 'Dodano nowe ogłoszenie.',
        'settings_field': 'posts_enabled',
    },
    EmailNotificationEventType.MESSAGES: {
        'subject': 'Nowa wiadomość - Przedszkole Pszczolka Maja',
        'body': 'Masz nowa wiadomosc od dyrekcji.',
        'settings_field': 'messages_enabled',
    },
    EmailNotificationEventType.GALLERY: {
        'subject': 'Nowy album - Przedszkole Pszczolka Maja',
        'body': 'Dodano nowy album ze zdjeciami.',
        'settings_field': 'gallery_enabled',
    },
    EmailNotificationEventType.PAYMENTS: {
        'subject': 'Nowa płatność - Przedszkole Pszczolka Maja',
        'body': 'Dodano nowa platnosc dla dziecka.',
        'settings_field': 'payments_enabled',
    },
    EmailNotificationEventType.SCHEDULE: {
        'subject': 'Nowy plan zajęć - Przedszkole Pszczolka Maja',
        'body': 'Dodano nowe zajecia w dzienniku.',
        'settings_field': 'schedule_enabled',
    },
    EmailNotificationEventType.CALENDAR: {
        'subject': 'Nowa informacja w kalendarzu - Przedszkole Pszczolka Maja',
        'body': 'Dodano nowy dzien wolny w placowce.',
        'settings_field': 'calendar_enabled',
    },
}

LOGGER = logging.getLogger(__name__)
EMAIL_ASYNC_WORKERS = int(getattr(settings, 'EMAIL_ASYNC_WORKERS', 4) or 4)
EMAIL_EXECUTOR = ThreadPoolExecutor(max_workers=max(1, EMAIL_ASYNC_WORKERS))


def _get_or_create_settings(user):
    settings_obj, _ = ParentEmailNotificationSettings.objects.get_or_create(user=user)
    return settings_obj


def _is_event_enabled(settings_obj, event_type):
    event_config = EVENT_MESSAGES.get(event_type)
    if not event_config:
        return False
    return bool(getattr(settings_obj, event_config['settings_field'], False))


def _send_email_in_background(user_id, event_type, recipient_email, subject, body, target_day):
    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [recipient_email],
            fail_silently=False,
        )
    except Exception:
        # If SMTP fails, reopen the daily slot to allow retry by next event.
        ParentEmailNotificationState.objects.filter(
            user_id=user_id,
            event_type=event_type,
            last_sent_on=target_day,
        ).update(last_sent_on=None)
        LOGGER.exception('Background email send failed for user_id=%s event=%s', user_id, event_type)


def _dispatch_email_async(user_id, event_type, recipient_email, subject, body, target_day):
    EMAIL_EXECUTOR.submit(
        _send_email_in_background,
        user_id,
        event_type,
        recipient_email,
        subject,
        body,
        target_day,
    )


def queue_parent_email_notification(user, event_type):
    """
    Queue notification e-mail for background delivery (non-blocking request).
    At most one e-mail is sent per day per parent+event_type.
    """
    if not user or not user.is_parent or not user.email:
        return False

    if event_type not in EVENT_MESSAGES:
        return False

    settings_obj = _get_or_create_settings(user)
    if not _is_event_enabled(settings_obj, event_type):
        return False

    today = timezone.localdate()
    event_config = EVENT_MESSAGES[event_type]

    with transaction.atomic():
        state, _ = ParentEmailNotificationState.objects.select_for_update().get_or_create(
            user=user,
            event_type=event_type,
        )

        if state.last_sent_on == today:
            return False

        state.last_sent_on = today
        state.pending_count = 0
        state.pending_send_at = None
        state.save(update_fields=['last_sent_on', 'pending_count', 'pending_send_at', 'updated_at'])

        transaction.on_commit(
            lambda: _dispatch_email_async(
                user.id,
                event_type,
                user.email,
                event_config['subject'],
                event_config['body'],
                today,
            )
        )

    return True


def _clear_pending_state(state):
    state.pending_count = 0
    state.pending_send_at = None


def send_due_parent_email_notifications(limit=500):
    """
    Compatibility no-op: notifications are sent immediately on event.
    """
    _ = limit
    return {
        'processed': 0,
        'sent': 0,
        'skipped': 0,
        'failed': 0,
    }
