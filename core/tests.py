from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from core.models import Attendance, Child, FacilityClosure, Group, Payment, RecurringPayment


def business_days_between(first_day, last_day):
	count = 0
	current_day = first_day
	while current_day <= last_day:
		if current_day.isoweekday() <= 5:
			count += 1
		current_day += timedelta(days=1)
	return count


class FacilityClosureAttendanceCleanupTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Smerfy',
			teachers_info='Anna Kowalska'
		)
		self.parent = get_user_model().objects.create_user(
			username='parent1',
			password='secret123'
		)
		self.child = Child.objects.create(
			group=self.group,
			first_name='Jan',
			last_name='Nowak',
			date_of_birth=date(2020, 1, 10)
		)
		self.child.parents.add(self.parent)

	def test_saving_closure_deletes_attendance_for_same_day(self):
		target_date = date(2026, 2, 14)
		Attendance.objects.create(child=self.child, date=target_date, status='absent')

		FacilityClosure.objects.create(date=target_date, reason='Dzień techniczny')

		self.assertFalse(Attendance.objects.filter(child=self.child, date=target_date).exists())

	def test_saving_closure_keeps_attendance_for_other_days(self):
		date_with_absence = date(2026, 2, 13)
		closure_date = date(2026, 2, 14)
		Attendance.objects.create(child=self.child, date=date_with_absence, status='absent')

		FacilityClosure.objects.create(date=closure_date, reason='Dzień techniczny')

		self.assertTrue(Attendance.objects.filter(child=self.child, date=date_with_absence).exists())


class PaymentAmountValidationTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Biedronki',
			teachers_info='Maria Wiśniewska'
		)
		self.parent = get_user_model().objects.create_user(
			username='parent2',
			password='secret123'
		)
		self.child = Child.objects.create(
			group=self.group,
			first_name='Ola',
			last_name='Kowal',
			date_of_birth=date(2020, 5, 20)
		)
		self.child.parents.add(self.parent)

	def test_full_clean_rejects_negative_payment_amount(self):
		payment = Payment(
			child=self.child,
			amount=Decimal('-10.00'),
			description='Czesne luty',
		)

		with self.assertRaises(ValidationError):
			payment.full_clean()

	def test_database_constraint_rejects_negative_payment_amount(self):
		with self.assertRaises(IntegrityError):
			Payment.objects.create(
				child=self.child,
				amount=Decimal('-1.00'),
				description='Czesne marzec',
			)


class MealPaymentUniquenessTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Motylki',
			teachers_info='Julia Maj'
		)
		self.parent = get_user_model().objects.create_user(
			username='parent3',
			password='secret123'
		)
		self.child = Child.objects.create(
			group=self.group,
			first_name='Mia',
			last_name='Lis',
			date_of_birth=date(2021, 3, 15)
		)
		self.child.parents.add(self.parent)

	def test_database_constraint_rejects_duplicate_meal_payment_for_same_month(self):
		meal_period = date(2026, 1, 1)
		Payment.objects.create(
			child=self.child,
			amount=Decimal('100.00'),
			description='Wyżywienie: styczeń 2026',
			meal_period=meal_period,
		)

		with self.assertRaises(IntegrityError):
			Payment.objects.create(
				child=self.child,
				amount=Decimal('90.00'),
				description='Wyżywienie: styczeń 2026 - duplikat',
				meal_period=meal_period,
			)


class MealPaymentGenerationFlagTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Pszczółki',
			teachers_info='Joanna Test'
		)
		self.parent = get_user_model().objects.create_user(
			username='parent4',
			password='secret123'
		)

		self.child_with_meals = Child.objects.create(
			group=self.group,
			first_name='Ala',
			last_name='Mak',
			date_of_birth=date(2020, 6, 10),
			meal_rate=Decimal('20.00'),
			uses_meals=True,
		)
		self.child_with_meals.parents.add(self.parent)

		self.child_without_meals = Child.objects.create(
			group=self.group,
			first_name='Olek',
			last_name='Sok',
			date_of_birth=date(2020, 7, 12),
			meal_rate=Decimal('20.00'),
			uses_meals=False,
		)
		self.child_without_meals.parents.add(self.parent)

	@patch('core.management.commands.generate_meal_payments.timezone.now')
	def test_command_generates_meal_payment_only_for_children_using_meals(self, mock_now):
		mock_now.return_value = timezone.make_aware(datetime(2026, 3, 15, 10, 0, 0))

		call_command('generate_meal_payments')

		self.assertTrue(
			Payment.objects.filter(
				child=self.child_with_meals,
				meal_period=date(2026, 3, 1),
			).exists()
		)
		self.assertFalse(Payment.objects.filter(child=self.child_without_meals).exists())


class MealPaymentProrationTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Misie',
			teachers_info='Katarzyna Test'
		)
		self.parent = get_user_model().objects.create_user(
			username='parent5',
			password='secret123'
		)

		self.child = Child.objects.create(
			group=self.group,
			first_name='Leo',
			last_name='Nowy',
			date_of_birth=date(2020, 8, 3),
			meal_rate=Decimal('20.00'),
			uses_meals=True,
			meal_start_date=date(2026, 2, 16),
		)
		self.child.parents.add(self.parent)

	@patch('core.management.commands.generate_meal_payments.timezone.now')
	def test_command_deducts_previous_month_absences_in_next_month(self, mock_now):
		mock_now.return_value = timezone.make_aware(datetime(2026, 3, 15, 10, 0, 0))
		Attendance.objects.create(
			child=self.child,
			date=date(2026, 2, 20),
			status='absent'
		)

		call_command('generate_meal_payments')

		payment = Payment.objects.get(child=self.child, meal_period=date(2026, 3, 1))

		march_business_days = business_days_between(date(2026, 3, 1), date(2026, 3, 31))
		expected_amount = Decimal(march_business_days - 1) * Decimal('20.00')

		self.assertEqual(payment.amount, expected_amount)


class MealActivationAutoPaymentTests(TestCase):
	@patch('core.signals.timezone.now')
	def test_enabling_meals_creates_first_payment_for_start_month(self, mock_now):
		mock_now.return_value = timezone.make_aware(datetime(2026, 1, 10, 9, 0, 0))

		group = Group.objects.create(
			name='Rybki',
			teachers_info='Test Opiekun'
		)
		parent = get_user_model().objects.create_user(
			username='parent6',
			password='secret123'
		)

		child = Child.objects.create(
			group=group,
			first_name='Nina',
			last_name='Nowak',
			date_of_birth=date(2021, 4, 1),
			meal_rate=Decimal('20.00'),
			uses_meals=False,
		)
		child.parents.add(parent)

		child.uses_meals = True
		child.meal_start_date = date(2026, 1, 15)
		child.save()

		payment = Payment.objects.get(child=child, meal_period=date(2026, 1, 1))
		self.assertEqual(payment.amount, Decimal('240.00'))


class PaymentTitleGenerationTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Sówki',
			teachers_info='Test Nauczyciel'
		)
		self.child = Child.objects.create(
			group=self.group,
			first_name='Jan',
			last_name='Nowak',
			date_of_birth=date(2020, 2, 2),
		)

	def test_generated_title_does_not_duplicate_after_deletion(self):
		p1 = Payment.objects.create(
			child=self.child,
			amount=Decimal('100.00'),
			description='Opłata 1',
		)
		p2 = Payment.objects.create(
			child=self.child,
			amount=Decimal('120.00'),
			description='Opłata 2',
		)
		p3 = Payment.objects.create(
			child=self.child,
			amount=Decimal('130.00'),
			description='Opłata 3',
		)

		p2.delete()

		p4 = Payment.objects.create(
			child=self.child,
			amount=Decimal('140.00'),
			description='Opłata 4',
		)

		suffixes = [
			payment.payment_title.rsplit('/', 1)[-1]
			for payment in [p1, p3, p4]
		]
		self.assertEqual(len(set(suffixes)), 3)


class RecurringPaymentGenerationTests(TestCase):
	def setUp(self):
		self.group = Group.objects.create(
			name='Jeżyki',
			teachers_info='Test Opiekun'
		)

		self.child_a = Child.objects.create(
			group=self.group,
			first_name='Ada',
			last_name='Nowak',
			date_of_birth=date(2020, 1, 1),
		)
		self.child_b = Child.objects.create(
			group=self.group,
			first_name='Bartek',
			last_name='Kowal',
			date_of_birth=date(2020, 2, 2),
		)

	def test_command_creates_payment_for_each_assigned_child(self):
		template = RecurringPayment.objects.create(
			amount=Decimal('75.00'),
			description='Rada rodziców',
			frequency='monthly',
			next_payment_date=date(2026, 3, 1),
			is_active=True,
		)
		template.children.add(self.child_a, self.child_b)

		with patch('core.management.commands.process_recurring.timezone.now') as mock_now:
			mock_now.return_value = timezone.make_aware(datetime(2026, 3, 7, 10, 0, 0))
			call_command('process_recurring')

		generated = Payment.objects.filter(description='Rada rodziców').order_by('child_id')
		self.assertEqual(generated.count(), 2)
		self.assertEqual(generated[0].child_id, self.child_a.id)
		self.assertEqual(generated[1].child_id, self.child_b.id)

		template.refresh_from_db()
		self.assertEqual(template.next_payment_date, date(2026, 4, 1))
