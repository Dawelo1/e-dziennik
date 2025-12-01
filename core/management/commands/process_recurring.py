from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import RecurringPayment, Payment

class Command(BaseCommand):
    help = 'Generuje płatności z aktywnych szablonów cyklicznych'

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        
        # Pobierz wszystkie aktywne szablony, których data nadeszła (lub minęła)
        templates = RecurringPayment.objects.filter(is_active=True, next_payment_date__lte=today)
        
        count = 0
        for template in templates:
            # 1. Stwórz realną płatność
            Payment.objects.create(
                child=template.child,
                amount=template.amount,
                description=template.description, # np. "Czesne"
                is_paid=False
                # payment_title wygeneruje się sam w modelu Payment
            )
            
            # 2. Zaktualizuj datę następnej płatności (np. na marzec)
            template.update_next_date()
            count += 1

        self.stdout.write(self.style.SUCCESS(f'Wygenerowano {count} płatności cyklicznych.'))