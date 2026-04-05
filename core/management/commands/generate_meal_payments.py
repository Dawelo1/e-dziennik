from django.core.management.base import BaseCommand
from django.utils import timezone
from core.meal_payments import generate_current_month_meal_payments

class Command(BaseCommand):
    help = 'Generuje płatności za wyżywienie za BIEŻĄCY miesiąc i odejmuje nieobecności z poprzedniego miesiąca'

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        result = generate_current_month_meal_payments(
            today=today,
            include_previous_month_absences=True,
        )

        self.stdout.write(
            f"Obliczam należności za bieżący miesiąc: {result['meal_period']} (korekta o nieobecności z poprzedniego miesiąca)"
        )

        self.stdout.write(self.style.SUCCESS(
            f"Wygenerowano {result['created_count']} płatności za posiłki. Pominięto {result['skipped_count']} istniejących."
        ))