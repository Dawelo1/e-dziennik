from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from core.meal_payments import ensure_meal_payment_for_period
from core.models import Child, DailyMenu


@receiver(pre_save, sender=Child)
def cache_previous_meal_settings(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_uses_meals = None
        return

    previous = Child.objects.filter(pk=instance.pk).values('uses_meals').first()
    instance._previous_uses_meals = previous['uses_meals'] if previous else None


@receiver(post_save, sender=Child)
def create_first_meal_payment_after_activation(sender, instance, created, **kwargs):
    if not instance.uses_meals:
        return

    previous_uses_meals = getattr(instance, '_previous_uses_meals', None)
    was_just_activated = created or previous_uses_meals is False

    if not was_just_activated:
        return

    period_source_date = instance.meal_start_date or timezone.now().date()

    ensure_meal_payment_for_period(
        child=instance,
        meal_period=period_source_date.replace(day=1),
        include_previous_month_absences=False,
    )


@receiver(post_delete, sender=DailyMenu)
def delete_daily_menu_image_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)


@receiver(pre_save, sender=DailyMenu)
def delete_replaced_daily_menu_image_file(sender, instance, **kwargs):
    if not instance.pk:
        return

    previous = DailyMenu.objects.filter(pk=instance.pk).only('image').first()
    if not previous or not previous.image:
        return

    new_image_name = instance.image.name if instance.image else None
    if previous.image.name != new_image_name:
        previous.image.delete(save=False)