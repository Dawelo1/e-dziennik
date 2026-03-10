from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from communication.models import Message
from users.models import User


class CommunicationApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.password = 'secret123'

		self.director = User.objects.create_user(
			username='director_msg',
			password=self.password,
			email='director_msg@example.com',
			is_director=True,
			is_parent=False,
		)
		self.parent_1 = User.objects.create_user(
			username='parent_one',
			password=self.password,
			email='parent_one@example.com',
			is_director=False,
			is_parent=True,
		)
		self.parent_2 = User.objects.create_user(
			username='parent_two',
			password=self.password,
			email='parent_two@example.com',
			is_director=False,
			is_parent=True,
		)
		self.outsider = User.objects.create_user(
			username='outsider',
			password=self.password,
			email='outsider@example.com',
			is_director=False,
			is_parent=False,
		)

	def test_director_sees_all_messages(self):
		Message.objects.create(sender=self.parent_1, receiver=self.director, subject='A', body='A')
		Message.objects.create(sender=self.parent_2, receiver=self.director, subject='B', body='B')

		self.client.force_authenticate(self.director)
		response = self.client.get(reverse('messages-list'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 2)

	def test_parent_sees_only_own_conversation(self):
		own = Message.objects.create(sender=self.parent_1, receiver=self.director, subject='Own', body='Own')
		Message.objects.create(sender=self.parent_2, receiver=self.director, subject='Other', body='Other')

		self.client.force_authenticate(self.parent_1)
		response = self.client.get(reverse('messages-list'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		ids = [row['id'] for row in response.data]
		self.assertEqual(ids, [own.id])

	def test_parent_create_message_auto_assigns_director_receiver(self):
		self.client.force_authenticate(self.parent_1)
		response = self.client.post(reverse('messages-list'), {
			'receiver': self.parent_2.id,
			'subject': 'Pytanie',
			'body': 'Treść',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['receiver'], self.director.id)
		self.assertEqual(response.data['sender'], self.parent_1.id)

	def test_parent_create_message_fails_when_director_missing(self):
		self.director.delete()
		self.client.force_authenticate(self.parent_1)
		response = self.client.post(reverse('messages-list'), {
			'subject': 'Pytanie',
			'body': 'Treść',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('receiver', response.data)

	def test_director_create_requires_receiver(self):
		self.client.force_authenticate(self.director)
		response = self.client.post(reverse('messages-list'), {
			'subject': 'Komunikat',
			'body': 'Treść',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('receiver', response.data)

	def test_director_create_with_receiver_succeeds(self):
		self.client.force_authenticate(self.director)
		response = self.client.post(reverse('messages-list'), {
			'receiver': self.parent_1.id,
			'subject': 'Komunikat',
			'body': 'Treść',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['receiver'], self.parent_1.id)
		self.assertEqual(response.data['sender'], self.director.id)

	def test_outsider_cannot_send_messages(self):
		self.client.force_authenticate(self.outsider)
		response = self.client.post(reverse('messages-list'), {
			'receiver': self.parent_1.id,
			'subject': 'Brak roli',
			'body': 'Treść',
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_unread_count_returns_only_user_unread(self):
		Message.objects.create(sender=self.director, receiver=self.parent_1, subject='1', body='1', is_read=False)
		Message.objects.create(sender=self.director, receiver=self.parent_1, subject='2', body='2', is_read=False)
		Message.objects.create(sender=self.parent_1, receiver=self.director, subject='3', body='3', is_read=False)

		self.client.force_authenticate(self.parent_1)
		response = self.client.get(reverse('messages-unread-count'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['count'], 2)

	def test_mark_conversation_read_director_requires_participant(self):
		self.client.force_authenticate(self.director)
		response = self.client.post(reverse('messages-mark-conversation-read'), {}, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_mark_conversation_read_director_marks_selected_parent(self):
		m1 = Message.objects.create(sender=self.parent_1, receiver=self.director, subject='1', body='1', is_read=False)
		m2 = Message.objects.create(sender=self.parent_2, receiver=self.director, subject='2', body='2', is_read=False)

		self.client.force_authenticate(self.director)
		response = self.client.post(reverse('messages-mark-conversation-read'), {
			'participant_id': self.parent_1.id,
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['updated_count'], 1)

		m1.refresh_from_db()
		m2.refresh_from_db()
		self.assertTrue(m1.is_read)
		self.assertFalse(m2.is_read)

	def test_mark_conversation_read_parent_defaults_to_director(self):
		message = Message.objects.create(sender=self.director, receiver=self.parent_1, subject='1', body='1', is_read=False)

		self.client.force_authenticate(self.parent_1)
		response = self.client.post(reverse('messages-mark-conversation-read'), {}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['updated_count'], 1)

		message.refresh_from_db()
		self.assertTrue(message.is_read)

	def test_mark_all_read_with_sender_id_marks_only_that_sender(self):
		m1 = Message.objects.create(sender=self.parent_1, receiver=self.director, subject='1', body='1', is_read=False)
		m2 = Message.objects.create(sender=self.parent_2, receiver=self.director, subject='2', body='2', is_read=False)

		self.client.force_authenticate(self.director)
		response = self.client.post(reverse('messages-mark-all-read'), {
			'sender_id': self.parent_1.id,
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['updated_count'], 1)

		m1.refresh_from_db()
		m2.refresh_from_db()
		self.assertTrue(m1.is_read)
		self.assertFalse(m2.is_read)

	def test_mark_all_read_without_sender_marks_all_unread_for_user(self):
		m1 = Message.objects.create(sender=self.parent_1, receiver=self.director, subject='1', body='1', is_read=False)
		m2 = Message.objects.create(sender=self.parent_2, receiver=self.director, subject='2', body='2', is_read=False)

		self.client.force_authenticate(self.director)
		response = self.client.post(reverse('messages-mark-all-read'), {}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['updated_count'], 2)

		m1.refresh_from_db()
		m2.refresh_from_db()
		self.assertTrue(m1.is_read)
		self.assertTrue(m2.is_read)

	def test_mark_conversation_read_parent_with_participant_id_works(self):
		message = Message.objects.create(sender=self.parent_2, receiver=self.parent_1, subject='1', body='1', is_read=False)

		self.client.force_authenticate(self.parent_1)
		response = self.client.post(reverse('messages-mark-conversation-read'), {
			'participant_id': self.parent_2.id,
		}, format='json')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['updated_count'], 1)

		message.refresh_from_db()
		self.assertTrue(message.is_read)
