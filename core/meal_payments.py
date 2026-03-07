import datetime
from decimal import Decimal

from core.models import Attendance, Child, FacilityClosure, Payment


POLISH_MONTH_NAMES = {
    1: 'styczeń',
    2: 'luty',
    3: 'marzec',
    4: 'kwiecień',
    5: 'maj',
    6: 'czerwiec',
    7: 'lipiec',
    8: 'sierpień',
    9: 'wrzesień',
    10: 'październik',
    11: 'listopad',
    12: 'grudzień',
}


def _month_bounds(any_date):
    first_day = any_date.replace(day=1)
    next_month = first_day + datetime.timedelta(days=32)
    first_day_next_month = next_month.replace(day=1)
    last_day = first_day_next_month - datetime.timedelta(days=1)
    return first_day, last_day


def _get_closed_dates(first_day, last_day):
    return set(
        FacilityClosure.objects.filter(
            date__range=[first_day, last_day]
        ).values_list('date', flat=True)
    )


def _count_business_days(first_day, last_day, closed_dates):
    days = 0
    current_date = first_day
    while current_date <= last_day:
        if current_date.isoweekday() <= 5 and current_date not in closed_dates:
            days += 1
        current_date += datetime.timedelta(days=1)
    return days


def _count_billable_absences(child, first_day, last_day, closed_dates):
    absence_dates = Attendance.objects.filter(
        child=child,
        date__range=[first_day, last_day],
        status='absent',
    ).values_list('date', flat=True)

    return sum(
        1
        for absence_date in absence_dates
        if absence_date.isoweekday() <= 5 and absence_date not in closed_dates
    )


def _active_period_start(child, month_first_day):
    if child.meal_start_date and child.meal_start_date > month_first_day:
        return child.meal_start_date
    return month_first_day


def _calculate_period_amount(child, meal_period, include_previous_month_absences):
    period_first_day, period_last_day = _month_bounds(meal_period)
    active_start_date = _active_period_start(child, period_first_day)

    if active_start_date > period_last_day:
        return None

    current_month_closed = _get_closed_dates(period_first_day, period_last_day)
    current_month_days = _count_business_days(active_start_date, period_last_day, current_month_closed)

    previous_month_absences = 0
    if include_previous_month_absences:
        previous_month_last_day = period_first_day - datetime.timedelta(days=1)
        previous_month_first_day = previous_month_last_day.replace(day=1)
        previous_active_start = _active_period_start(child, previous_month_first_day)

        if previous_active_start <= previous_month_last_day:
            previous_month_closed = _get_closed_dates(previous_month_first_day, previous_month_last_day)
            previous_month_absences = _count_billable_absences(
                child,
                previous_active_start,
                previous_month_last_day,
                previous_month_closed,
            )

    billable_days = max(current_month_days - previous_month_absences, 0)
    amount = (Decimal(billable_days) * child.meal_rate).quantize(Decimal('0.01'))
    month_name = f"{POLISH_MONTH_NAMES[period_first_day.month]} {period_first_day.year}"

    if previous_month_absences:
        description = (
            f"Wyżywienie: {month_name} "
            f"({current_month_days} dni - {previous_month_absences} nieobecności z poprzedniego miesiąca "
            f"= {billable_days} dni x {child.meal_rate} zł)"
        )
    else:
        description = f"Wyżywienie: {month_name} ({billable_days} dni x {child.meal_rate} zł)"

    return {
        'meal_period': period_first_day,
        'amount': amount,
        'description': description,
    }


def ensure_meal_payment_for_period(child: Child, meal_period, include_previous_month_absences=True):
    meal_period_first_day = meal_period.replace(day=1)

    existing_payment = Payment.objects.filter(
        child=child,
        meal_period=meal_period_first_day,
    ).first()
    if existing_payment:
        return existing_payment, False

    month_name = f"{POLISH_MONTH_NAMES[meal_period_first_day.month]} {meal_period_first_day.year}"
    legacy_payment = Payment.objects.filter(
        child=child,
        description__startswith=f"Wyżywienie: {month_name}",
    ).order_by('created_at').first()

    if legacy_payment:
        if legacy_payment.meal_period is None:
            legacy_payment.meal_period = meal_period_first_day
            legacy_payment.save(update_fields=['meal_period'])
        return legacy_payment, False

    calculated = _calculate_period_amount(
        child=child,
        meal_period=meal_period_first_day,
        include_previous_month_absences=include_previous_month_absences,
    )
    if not calculated or calculated['amount'] <= 0:
        return None, False

    payment = Payment.objects.create(
        child=child,
        amount=calculated['amount'],
        description=calculated['description'],
        is_paid=False,
        meal_period=calculated['meal_period'],
    )
    return payment, True