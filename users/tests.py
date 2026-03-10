from datetime import date, time

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core.models import Child, FacilityClosure, GalleryItem, Group, Payment, SpecialActivity
from users.models import User


class UsersApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.password = 'secret123'
		self.parent = User.objects.create_user(
			username='parent_api',
			password=self.password,
			email='parent@example.com',
			first_name='Anna',
			last_name='Parent',
			is_parent=True,
			is_director=False,
		)
		self.director = User.objects.create_user(
			username='director_api',
			password=self.password,
			email='director@example.com',
			first_name='Daria',
			last_name='Director',
			is_parent=False,
			is_director=True,
		)

		self.group_a = Group.objects.create(name='Smerfy', teachers_info='Ala Nauczyciel')
		self.group_b = Group.objects.create(name='Biedronki', teachers_info='Ola Nauczyciel')

		self.child_parent = Child.objects.create(
			first_name='Jan',
			last_name='Nowak',
			date_of_birth=date(2020, 5, 1),
			group=self.group_a,
			meal_rate='20.00',
			uses_meals=False,
		)
		self.child_parent.parents.add(self.parent)

		self.other_parent = User.objects.create_user(
			username='other_parent',
			password=self.password,
			email='other@example.com',
			is_parent=True,
			is_director=False,
		)
		self.other_child = Child.objects.create(
			first_name='Ola',
			last_name='Kowalska',
			date_of_birth=date(2020, 6, 1),
			group=self.group_b,
			meal_rate='20.00',
			uses_meals=False,
		)
		self.other_child.parents.add(self.other_parent)

	def test_change_password_requires_authentication(self):
		response = self.client.put(reverse('change-password'), {
			'old_password': self.password,
			'new_password': 'newpass123',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_change_password_rejects_wrong_old_password(self):
		self.client.force_authenticate(self.parent)
		response = self.client.put(reverse('change-password'), {
			'old_password': 'wrong-old',
			'new_password': 'newpass123',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('old_password', response.data)

	def test_change_password_success_and_clears_preview(self):
		self.parent.director_password_preview = 'old-preview'
		self.parent.director_password_preview_active = True
		self.parent.save(update_fields=['director_password_preview', 'director_password_preview_active'])

		self.client.force_authenticate(self.parent)
		response = self.client.put(reverse('change-password'), {
			'old_password': self.password,
			'new_password': 'newpass123',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.parent.refresh_from_db()
		self.assertTrue(self.parent.check_password('newpass123'))
		self.assertIsNone(self.parent.director_password_preview)
		self.assertFalse(self.parent.director_password_preview_active)

	def test_current_user_get_returns_profile(self):
		self.client.force_authenticate(self.parent)
		response = self.client.get(reverse('current-user'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['username'], 'parent_api')
		self.assertIn('child_groups', response.data)

	def test_current_user_patch_updates_allowed_fields(self):
		self.client.force_authenticate(self.parent)
		response = self.client.patch(reverse('current-user'), {
			'first_name': 'Anna2',
			'last_name': 'Parent2',
			'phone_number': '+48123123123',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.parent.refresh_from_db()
		self.assertEqual(self.parent.first_name, 'Anna2')
		self.assertEqual(self.parent.last_name, 'Parent2')
		self.assertEqual(self.parent.phone_number, '+48123123123')

	def test_current_user_patch_avatar_delete_works_without_existing_avatar(self):
		self.client.force_authenticate(self.parent)
		response = self.client.patch(reverse('current-user'), {
			'avatar': 'DELETE',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.parent.refresh_from_db()
		self.assertFalse(bool(self.parent.avatar))

	def test_custom_token_auth_returns_token_and_sets_director_online_cache(self):
		cache.delete(f'director_online_{self.director.id}')
		response = self.client.post(reverse('api_token_auth'), {
			'username': 'director_api',
			'password': self.password,
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('token', response.data)
		self.assertTrue(cache.get(f'director_online_{self.director.id}'))

	def test_director_status_reports_online_from_cache(self):
		self.client.force_authenticate(self.parent)
		cache.set(f'director_online_{self.director.id}', True, 300)
		response = self.client.get(reverse('director-status'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(response.data['is_online'])

	def test_notification_summary_counts_for_parent_scope(self):
		activity_for_parent = SpecialActivity.objects.create(
			title='Teatrzyk',
			description='Opis',
			date=date(2026, 3, 10),
			start_time=time(9, 0),
			end_time=time(10, 0),
		)
		activity_for_parent.groups.add(self.group_a)

		activity_other = SpecialActivity.objects.create(
			title='Wycieczka',
			description='Opis',
			date=date(2026, 3, 11),
			start_time=time(9, 0),
			end_time=time(10, 0),
		)
		activity_other.groups.add(self.group_b)

		GalleryItem.objects.create(title='Publiczny album', description='x', target_group=None)
		GalleryItem.objects.create(title='Album grupy A', description='x', target_group=self.group_a)
		GalleryItem.objects.create(title='Album grupy B', description='x', target_group=self.group_b)

		FacilityClosure.objects.create(date=date(2026, 3, 12), reason='Święto')

		Payment.objects.create(child=self.child_parent, amount='100.00', description='Czesne')
		Payment.objects.create(child=self.other_child, amount='100.00', description='Czesne')

		self.client.force_authenticate(self.parent)
		response = self.client.get(reverse('notifications-summary'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['schedule'], 1)
		self.assertEqual(response.data['gallery'], 2)
		self.assertEqual(response.data['calendar'], 1)
		self.assertEqual(response.data['payments'], 1)

	def test_notification_summary_includes_schedule_extra_cache(self):
		activity = SpecialActivity.objects.create(
			title='Warsztaty',
			description='Opis',
			date=date(2026, 3, 13),
			start_time=time(9, 0),
			end_time=time(10, 0),
		)
		activity.groups.add(self.group_a)
		cache.set(f'notification_schedule_extra_{self.parent.id}', 4, 300)

		self.client.force_authenticate(self.parent)
		response = self.client.get(reverse('notifications-summary'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['schedule'], 5)

	def test_mark_notification_seen_rejects_invalid_section(self):
		self.client.force_authenticate(self.parent)
		response = self.client.post(reverse('notifications-mark-seen'), {
			'section': 'unknown',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_mark_notification_seen_updates_last_seen_and_clears_schedule_extra(self):
		activity = SpecialActivity.objects.create(
			title='Zajęcia',
			description='Opis',
			date=date(2026, 3, 14),
			start_time=time(9, 0),
			end_time=time(10, 0),
		)
		activity.groups.add(self.group_a)
		cache.set(f'notification_schedule_extra_{self.parent.id}', 9, 300)

		self.client.force_authenticate(self.parent)
		response = self.client.post(reverse('notifications-mark-seen'), {
			'section': 'schedule',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.parent.refresh_from_db()
		self.assertEqual(self.parent.last_seen_schedule_activity_id, activity.id)
		self.assertEqual(cache.get(f'notification_schedule_extra_{self.parent.id}'), 0)

	def test_logout_deletes_token(self):
		token = Token.objects.create(user=self.parent)
		self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
		response = self.client.post(reverse('logout'), {}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertFalse(Token.objects.filter(user=self.parent).exists())


class UserManagementApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.password = 'secret123'
		self.director = User.objects.create_user(
			username='director_manage',
			password=self.password,
			email='director_manage@example.com',
			is_parent=False,
			is_director=True,
		)
		self.parent = User.objects.create_user(
			username='parent_manage',
			password=self.password,
			email='parent_manage@example.com',
			is_parent=True,
			is_director=False,
		)

	def test_user_management_requires_director(self):
		self.client.force_authenticate(self.parent)
		response = self.client.get(reverse('user-manage-list'))
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_user_management_list_for_director(self):
		self.client.force_authenticate(self.director)
		response = self.client.get(reverse('user-manage-list'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(isinstance(response.data, list))

	def test_generate_credentials_action_available_for_director(self):
		self.client.force_authenticate(self.director)
		response = self.client.get(reverse('user-manage-generate-credentials'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('username', response.data)
		self.assertIn('password', response.data)

	def test_create_user_with_generated_password_sets_preview_active(self):
		self.client.force_authenticate(self.director)
		payload = {
			'username': 'new_parent_preview',
			'email': 'new_parent_preview@example.com',
			'first_name': 'Nowy',
			'last_name': 'Rodzic',
			'phone_number': '+48111111111',
			'is_director': False,
			'is_parent': True,
			'password': 'Generated123!',
			'password_generated': True,
		}
		response = self.client.post(reverse('user-manage-list'), payload, format='json')
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)

		created = User.objects.get(username='new_parent_preview')
		self.assertTrue(created.director_password_preview_active)
		self.assertEqual(created.director_password_preview, 'Generated123!')

	def test_password_preview_returns_404_for_inactive_preview(self):
		self.client.force_authenticate(self.director)
		response = self.client.get(reverse('user-manage-password-preview', kwargs={'pk': self.parent.id}))
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

	def test_password_preview_returns_password_for_active_preview(self):
		self.parent.director_password_preview = 'Preview123!'
		self.parent.director_password_preview_active = True
		self.parent.save(update_fields=['director_password_preview', 'director_password_preview_active'])

		self.client.force_authenticate(self.director)
		response = self.client.get(reverse('user-manage-password-preview', kwargs={'pk': self.parent.id}))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['password'], 'Preview123!')

	def test_update_user_with_manual_password_clears_preview(self):
		self.parent.director_password_preview = 'OldPreview'
		self.parent.director_password_preview_active = True
		self.parent.save(update_fields=['director_password_preview', 'director_password_preview_active'])

		self.client.force_authenticate(self.director)
		response = self.client.patch(
			reverse('user-manage-detail', kwargs={'pk': self.parent.id}),
			{'password': 'Manual123!', 'password_generated': False},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.parent.refresh_from_db()
		self.assertTrue(self.parent.check_password('Manual123!'))
		self.assertIsNone(self.parent.director_password_preview)
		self.assertFalse(self.parent.director_password_preview_active)

	def test_search_filter_in_user_management(self):
		self.client.force_authenticate(self.director)
		response = self.client.get(reverse('user-manage-list'), {'search': 'parent_manage'})
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		usernames = [row['username'] for row in response.data]
		self.assertIn('parent_manage', usernames)
