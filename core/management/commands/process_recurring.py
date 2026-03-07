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
            # 1. Stwórz realne płatności dla wszystkich przypisanych dzieci
            for child in template.children.all():
                Payment.objects.create(
                    child=child,
                    amount=template.amount,
                    description=template.description, # np. "Czesne"
                    is_paid=False
                    # payment_title wygeneruje się sam w modelu Payment
                )
                count += 1
            
            # 2. Zaktualizuj datę następnej płatności (np. na marzec)
            template.update_next_date()

        self.stdout.write(self.style.SUCCESS(f'Wygenerowano {count} płatności cyklicznych.'))