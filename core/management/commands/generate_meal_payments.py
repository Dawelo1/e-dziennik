from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Child, Payment, Attendance, FacilityClosure
import datetime
from dateutil.relativedelta import relativedelta

class Command(BaseCommand):
    help = 'Generuje płatności za wyżywienie za POPRZEDNI miesiąc'

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        
        # Obliczamy zakres dat dla POPRZEDNIEGO miesiąca
        # Np. jeśli dziś jest 1 Lutego, to first_day = 1 Stycznia, last_day = 31 Stycznia
        first_day_of_current = today.replace(day=1)
        last_day_prev = first_day_of_current - datetime.timedelta(days=1)
        first_day_prev = last_day_prev.replace(day=1)

        month_name = first_day_prev.strftime("%B %Y") # np. "January 2025"
        
        self.stdout.write(f"Obliczam należności za okres: {first_day_prev} - {last_day_prev}")

        # 1. Obliczamy ile było dni roboczych (Pn-Pt) minus dni wolne (Closure)
        total_business_days = 0
        current_date = first_day_prev
        
        # Pobieramy daty zamknięte z bazy
        closed_dates = set(FacilityClosure.objects.filter(
            date__range=[first_day_prev, last_day_prev]
        ).values_list('date', flat=True))

        while current_date <= last_day_prev:
            # isoweekday: 1=Pon, 5=Pt, 6=Sob, 7=Ndz
            if current_date.isoweekday() <= 5: 
                # Jeśli to dzień roboczy I NIE MA go w dniach zamkniętych
                if current_date not in closed_dates:
                    total_business_days += 1
            current_date += datetime.timedelta(days=1)

        self.stdout.write(f"Maksymalna liczba dni płatnych w miesiącu: {total_business_days}")

        # 2. Dla każdego dziecka liczymy nieobecności
        children = Child.objects.all()
        count = 0

        for child in children:
            # Policz zgłoszone nieobecności w tym miesiącu
            absences = Attendance.objects.filter(
                child=child,
                date__range=[first_day_prev, last_day_prev],
                status='absent' # Tylko nieobecności
            ).count()

            billable_days = total_business_days - absences
            
            # Zabezpieczenie, żeby nie wyszło ujemnie (gdyby ktoś dodał więcej nieobecności niż dni pracy)
            if billable_days < 0: billable_days = 0

            amount_to_pay = billable_days * child.meal_rate

            if amount_to_pay > 0:
                Payment.objects.create(
                    child=child,
                    amount=amount_to_pay,
                    description=f"Wyżywienie: {month_name} ({billable_days} dni x {child.meal_rate} zł)",
                    is_paid=False
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'Wygenerowano {count} płatności za posiłki.'))