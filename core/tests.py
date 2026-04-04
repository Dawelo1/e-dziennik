from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from core.group_deletion import delete_group_with_related_data
from core.models import Attendance, Child, FacilityClosure, GalleryItem, Group, Payment, Post, RecurringPayment, SpecialActivity
from users.models import EmailNotificationEventType


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


class GroupDeepDeletionTests(TestCase):
	def setUp(self):
		self.group_to_delete = Group.objects.create(
			name='Do usuniecia',
			teachers_info='Opiekun A'
		)
		self.group_to_keep = Group.objects.create(
			name='Do pozostawienia',
			teachers_info='Opiekun B'
		)

		User = get_user_model()
		self.parent_only_deleted_group = User.objects.create_user(
			username='parent_delete',
			password='secret123',
			is_parent=True,
		)
		self.parent_with_other_group_child = User.objects.create_user(
			username='parent_keep',
			password='secret123',
			is_parent=True,
		)

		self.child_deleted_1 = Child.objects.create(
			group=self.group_to_delete,
			first_name='Ala',
			last_name='Usun',
			date_of_birth=date(2020, 1, 1),
		)
		self.child_deleted_1.parents.add(self.parent_only_deleted_group)

		self.child_deleted_2 = Child.objects.create(
			group=self.group_to_delete,
			first_name='Ola',
			last_name='Mix',
			date_of_birth=date(2020, 2, 2),
		)
		self.child_deleted_2.parents.add(self.parent_with_other_group_child)

		self.child_kept = Child.objects.create(
			group=self.group_to_keep,
			first_name='Mia',
			last_name='Mix',
			date_of_birth=date(2020, 3, 3),
		)
		self.child_kept.parents.add(self.parent_with_other_group_child)

		Payment.objects.create(
			child=self.child_deleted_1,
			amount=Decimal('150.00'),
			description='Platnosc do usuniecia',
		)
		Payment.objects.create(
			child=self.child_kept,
			amount=Decimal('200.00'),
			description='Platnosc do zachowania',
		)

		self.recurring_delete_only = RecurringPayment.objects.create(
			amount=Decimal('80.00'),
			description='Szablon usuwany',
			frequency='monthly',
			next_payment_date=date(2026, 4, 1),
		)
		self.recurring_delete_only.children.add(self.child_deleted_1)

		self.recurring_mixed = RecurringPayment.objects.create(
			amount=Decimal('90.00'),
			description='Szablon mieszany',
			frequency='monthly',
			next_payment_date=date(2026, 4, 1),
		)
		self.recurring_mixed.children.add(self.child_deleted_2, self.child_kept)

		self.post_for_deleted_group = Post.objects.create(
			title='Post grupowy',
			content='Do usuniecia',
			target_group=self.group_to_delete,
		)
		self.post_for_kept_group = Post.objects.create(
			title='Post innej grupy',
			content='Do zachowania',
			target_group=self.group_to_keep,
		)

		self.gallery_for_deleted_group = GalleryItem.objects.create(
			title='Album grupowy',
			target_group=self.group_to_delete,
		)
		self.gallery_for_kept_group = GalleryItem.objects.create(
			title='Album innej grupy',
			target_group=self.group_to_keep,
		)

		self.activity_only_deleted_group = SpecialActivity.objects.create(
			title='Wycieczka A',
			description='Tylko grupa usuwana',
			date=date(2026, 4, 15),
			start_time=datetime.strptime('10:00', '%H:%M').time(),
		)
		self.activity_only_deleted_group.groups.add(self.group_to_delete)

		self.activity_mixed_groups = SpecialActivity.objects.create(
			title='Wycieczka B',
			description='Dwie grupy',
			date=date(2026, 4, 20),
			start_time=datetime.strptime('11:00', '%H:%M').time(),
		)
		self.activity_mixed_groups.groups.add(self.group_to_delete, self.group_to_keep)

	def test_delete_group_removes_deep_related_data(self):
		delete_group_with_related_data(self.group_to_delete)

		self.assertFalse(Group.objects.filter(id=self.group_to_delete.id).exists())

		self.assertFalse(Child.objects.filter(id=self.child_deleted_1.id).exists())
		self.assertFalse(Child.objects.filter(id=self.child_deleted_2.id).exists())
		self.assertTrue(Child.objects.filter(id=self.child_kept.id).exists())

		self.assertFalse(Payment.objects.filter(child_id=self.child_deleted_1.id).exists())
		self.assertTrue(Payment.objects.filter(child_id=self.child_kept.id).exists())

		self.assertFalse(Post.objects.filter(id=self.post_for_deleted_group.id).exists())
		self.assertTrue(Post.objects.filter(id=self.post_for_kept_group.id).exists())

		self.assertFalse(GalleryItem.objects.filter(id=self.gallery_for_deleted_group.id).exists())
		self.assertTrue(GalleryItem.objects.filter(id=self.gallery_for_kept_group.id).exists())

		self.assertFalse(SpecialActivity.objects.filter(id=self.activity_only_deleted_group.id).exists())
		self.assertTrue(SpecialActivity.objects.filter(id=self.activity_mixed_groups.id).exists())
		self.activity_mixed_groups.refresh_from_db()
		self.assertNotIn(self.group_to_delete.id, self.activity_mixed_groups.groups.values_list('id', flat=True))
		self.assertIn(self.group_to_keep.id, self.activity_mixed_groups.groups.values_list('id', flat=True))

		self.assertFalse(RecurringPayment.objects.filter(id=self.recurring_delete_only.id).exists())
		self.assertTrue(RecurringPayment.objects.filter(id=self.recurring_mixed.id).exists())
		self.recurring_mixed.refresh_from_db()
		self.assertEqual(self.recurring_mixed.children.count(), 1)
		self.assertEqual(self.recurring_mixed.children.first().id, self.child_kept.id)

		User = get_user_model()
		self.assertFalse(User.objects.filter(id=self.parent_only_deleted_group.id).exists())
		self.assertTrue(User.objects.filter(id=self.parent_with_other_group_child.id).exists())


class GroupDeletePasswordRequirementTests(APITestCase):
	def setUp(self):
		self.director_password = 'sekret123!'
		self.director = get_user_model().objects.create_user(
			username='director_delete',
			password=self.director_password,
			is_director=True,
			is_parent=False,
		)
		self.empty_group = Group.objects.create(
			name='Pusta grupa',
			teachers_info='Nauczyciel Test'
		)
		self.group_with_child = Group.objects.create(
			name='Grupa z dzieckiem',
			teachers_info='Nauczyciel Test'
		)
		self.parent = get_user_model().objects.create_user(
			username='parent_delete_password',
			password='rodzic123',
			is_parent=True,
		)
		self.child = Child.objects.create(
			group=self.group_with_child,
			first_name='Jan',
			last_name='Test',
			date_of_birth=date(2020, 1, 1),
		)
		self.child.parents.add(self.parent)
		self.client = APIClient()
		self.client.force_authenticate(user=self.director)

	def test_delete_empty_group_without_password_returns_204(self):
		response = self.client.delete(f'/api/groups/{self.empty_group.id}/', data={}, format='json')

		self.assertEqual(response.status_code, 204)
		self.assertFalse(Group.objects.filter(id=self.empty_group.id).exists())

	def test_delete_group_with_children_without_password_returns_400(self):
		response = self.client.delete(f'/api/groups/{self.group_with_child.id}/', data={}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertIn('wpisz hasło dyrektora', (response.data.get('detail') or '').lower())
		self.assertTrue(Group.objects.filter(id=self.group_with_child.id).exists())

	def test_delete_group_with_invalid_password_returns_400(self):
		response = self.client.delete(
			f'/api/groups/{self.group_with_child.id}/',
			data={'director_password': 'zle-haslo'},
			format='json'
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn('nieprawidłowe hasło dyrektora', (response.data.get('detail') or '').lower())
		self.assertTrue(Group.objects.filter(id=self.group_with_child.id).exists())

	def test_delete_group_with_children_and_valid_password_returns_204(self):
		response = self.client.delete(
			f'/api/groups/{self.group_with_child.id}/',
			data={'director_password': self.director_password},
			format='json'
		)

		self.assertEqual(response.status_code, 204)
		self.assertFalse(Group.objects.filter(id=self.group_with_child.id).exists())


class EmailNotificationTriggerRulesTests(APITestCase):
	def setUp(self):
		self.director = get_user_model().objects.create_user(
			username='director_notify_rules',
			password='sekret123!',
			is_director=True,
			is_parent=False,
		)
		self.parent = get_user_model().objects.create_user(
			username='parent_notify_rules',
			email='parent.notify@example.com',
			password='rodzic123',
			is_parent=True,
		)
		self.group = Group.objects.create(
			name='Grupa notify',
			teachers_info='Nauczyciel Notify',
		)
		self.child = Child.objects.create(
			group=self.group,
			first_name='Mila',
			last_name='Test',
			date_of_birth=date(2020, 4, 1),
		)
		self.child.parents.add(self.parent)

		self.client = APIClient()
		self.client.force_authenticate(user=self.director)

	@patch('core.views.queue_parent_email_notification')
	def test_post_email_triggered_on_create_update_but_not_delete(self, mocked_queue):
		create_response = self.client.post(
			'/api/newsfeed/',
			data={
				'title': 'Nowy post',
				'content': 'Treść posta',
				'target_group': self.group.id,
			},
			format='json',
		)

		self.assertEqual(create_response.status_code, 201)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.POSTS)

		post_id = int(create_response.data['id'])
		mocked_queue.reset_mock()

		update_response = self.client.patch(
			f'/api/newsfeed/{post_id}/',
			data={'content': 'Zmieniona treść'},
			format='json',
		)

		self.assertEqual(update_response.status_code, 200)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.POSTS)

		mocked_queue.reset_mock()
		delete_response = self.client.delete(f'/api/newsfeed/{post_id}/')
		self.assertEqual(delete_response.status_code, 204)
		mocked_queue.assert_not_called()

	@patch('core.views.queue_parent_email_notification')
	def test_calendar_email_triggered_on_create_update_but_not_delete(self, mocked_queue):
		create_response = self.client.post(
			'/api/calendar/closures/',
			data={
				'date': '2026-06-10',
				'reason': 'Przerwa techniczna',
			},
			format='json',
		)

		self.assertEqual(create_response.status_code, 201)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.CALENDAR)

		closure_id = int(create_response.data['id'])
		mocked_queue.reset_mock()

		update_response = self.client.patch(
			f'/api/calendar/closures/{closure_id}/',
			data={'reason': 'Aktualizacja informacji'},
			format='json',
		)

		self.assertEqual(update_response.status_code, 200)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.CALENDAR)

		mocked_queue.reset_mock()
		delete_response = self.client.delete(f'/api/calendar/closures/{closure_id}/')
		self.assertEqual(delete_response.status_code, 204)
		mocked_queue.assert_not_called()

	@patch('core.views.queue_parent_email_notification')
	def test_schedule_email_triggered_on_create_update_but_not_delete(self, mocked_queue):
		create_response = self.client.post(
			'/api/calendar/activities/',
			data={
				'title': 'Teatrzyk',
				'description': 'Wizyta teatru',
				'date': '2026-06-12',
				'start_time': '10:00:00',
				'end_time': '11:00:00',
				'groups': [self.group.id],
			},
			format='json',
		)

		self.assertEqual(create_response.status_code, 201)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.SCHEDULE)

		activity_id = int(create_response.data['id'])
		mocked_queue.reset_mock()

		update_response = self.client.patch(
			f'/api/calendar/activities/{activity_id}/',
			data={'description': 'Zmieniony opis'},
			format='json',
		)

		self.assertEqual(update_response.status_code, 200)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.SCHEDULE)

		mocked_queue.reset_mock()
		delete_response = self.client.delete(f'/api/calendar/activities/{activity_id}/')
		self.assertEqual(delete_response.status_code, 204)
		mocked_queue.assert_not_called()

	@patch('core.views.queue_parent_email_notification')
	def test_gallery_email_triggered_on_create_update_but_not_delete(self, mocked_queue):
		create_response = self.client.post(
			'/api/gallery/',
			data={
				'title': 'Nowy album',
				'description': 'Opis albumu',
				'target_group': str(self.group.id),
			},
			format='multipart',
		)

		self.assertEqual(create_response.status_code, 201)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.GALLERY)

		album_id = int(create_response.data['id'])
		mocked_queue.reset_mock()

		update_response = self.client.put(
			f'/api/gallery/{album_id}/',
			data={
				'title': 'Nowy album po edycji',
				'description': 'Opis po edycji',
				'target_group': str(self.group.id),
			},
			format='multipart',
		)

		self.assertEqual(update_response.status_code, 200)
		mocked_queue.assert_called_once()
		self.assertEqual(mocked_queue.call_args.args[1], EmailNotificationEventType.GALLERY)

		mocked_queue.reset_mock()
		delete_response = self.client.delete(f'/api/gallery/{album_id}/')
		self.assertEqual(delete_response.status_code, 204)
		mocked_queue.assert_not_called()
