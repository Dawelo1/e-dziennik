from django.core.management.base import BaseCommand
from django.utils import timezone
from core.meal_payments import ensure_meal_payment_for_period
from core.models import Child

class Command(BaseCommand):
    help = 'Generuje płatności za wyżywienie za BIEŻĄCY miesiąc i odejmuje nieobecności z poprzedniego miesiąca'

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        first_day_of_current = today.replace(day=1)

        self.stdout.write(
            f"Obliczam należności za bieżący miesiąc: {first_day_of_current} (korekta o nieobecności z poprzedniego miesiąca)"
        )

        children = Child.objects.filter(uses_meals=True)
        count = 0
        skipped = 0

        for child in children:
            _, created = ensure_meal_payment_for_period(
                child=child,
                meal_period=first_day_of_current,
                include_previous_month_absences=True,
            )

            if created:
                count += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'Wygenerowano {count} płatności za posiłki. Pominięto {skipped} istniejących.'
        ))