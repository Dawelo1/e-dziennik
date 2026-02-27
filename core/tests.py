from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Attendance, Child, FacilityClosure, Group


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
		Attendance.objects.create(child=self.child, date=target_date, status='nieobecny')

		FacilityClosure.objects.create(date=target_date, reason='Dzień techniczny')

		self.assertFalse(Attendance.objects.filter(child=self.child, date=target_date).exists())

	def test_saving_closure_keeps_attendance_for_other_days(self):
		date_with_absence = date(2026, 2, 13)
		closure_date = date(2026, 2, 14)
		Attendance.objects.create(child=self.child, date=date_with_absence, status='nieobecny')

		FacilityClosure.objects.create(date=closure_date, reason='Dzień techniczny')

		self.assertTrue(Attendance.objects.filter(child=self.child, date=date_with_absence).exists())
