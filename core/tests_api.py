from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from core.models import (
    Attendance,
    Child,
    DailyMenu,
    FacilityClosure,
    GalleryItem,
    Group,
    Payment,
    Post,
    PostComment,
    RecurringPayment,
    SpecialActivity,
)
from communication.models import Message
from users.models import User


class CoreApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = 'secret123'

        self.director = User.objects.create_user(
            username='core_director',
            password=self.password,
            email='core_director@example.com',
            is_director=True,
            is_parent=False,
        )
        self.parent_1 = User.objects.create_user(
            username='core_parent_1',
            password=self.password,
            email='core_parent_1@example.com',
            is_director=False,
            is_parent=True,
        )
        self.parent_2 = User.objects.create_user(
            username='core_parent_2',
            password=self.password,
            email='core_parent_2@example.com',
            is_director=False,
            is_parent=True,
        )

        self.group_a = Group.objects.create(name='Smerfy', teachers_info='Ala')
        self.group_b = Group.objects.create(name='Biedronki', teachers_info='Ola')

        self.child_1 = Child.objects.create(
            first_name='Jan',
            last_name='Nowak',
            date_of_birth=date(2020, 1, 10),
            group=self.group_a,
            meal_rate='20.00',
            uses_meals=False,
        )
        self.child_1.parents.add(self.parent_1)

        self.child_2 = Child.objects.create(
            first_name='Ola',
            last_name='Kowal',
            date_of_birth=date(2020, 2, 11),
            group=self.group_b,
            meal_rate='20.00',
            uses_meals=False,
        )
        self.child_2.parents.add(self.parent_2)

    def _previous_weekday(self):
        day = timezone.localdate() - timedelta(days=1)
        while day.weekday() >= 5:
            day -= timedelta(days=1)
        return day

    def test_children_requires_authentication(self):
        response = self.client.get('/api/children/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_parent_sees_only_own_children(self):
        self.client.force_authenticate(self.parent_1)
        response = self.client.get('/api/children/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.child_1.id)

    def test_director_sees_all_children(self):
        self.client.force_authenticate(self.director)
        response = self.client.get('/api/children/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_parent_cannot_create_or_delete_child(self):
        self.client.force_authenticate(self.parent_1)
        create_response = self.client.post('/api/children/', {
            'first_name': 'X',
            'last_name': 'Y',
            'date_of_birth': '2020-01-01',
            'group': self.group_a.id,
            'parents': [self.parent_1.id],
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

        delete_response = self.client.delete(f'/api/children/{self.child_1.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_parent_patch_child_updates_only_medical_info(self):
        self.client.force_authenticate(self.parent_1)
        response = self.client.patch(
            f'/api/children/{self.child_1.id}/',
            {'first_name': 'Zmiana', 'medical_info': 'Alergia'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.child_1.refresh_from_db()
        self.assertEqual(self.child_1.first_name, 'Jan')
        self.assertEqual(self.child_1.medical_info, 'Alergia')

    def test_director_can_create_child(self):
        self.client.force_authenticate(self.director)
        response = self.client.post('/api/children/', {
            'first_name': 'Nowe',
            'last_name': 'Dziecko',
            'date_of_birth': '2020-03-01',
            'group': self.group_a.id,
            'parents': [self.parent_1.id],
            'meal_rate': '20.00',
            'uses_meals': False,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_parent_cannot_mark_payment_as_paid(self):
        payment = Payment.objects.create(child=self.child_1, amount='150.00', description='Czesne')
        self.client.force_authenticate(self.parent_1)
        response = self.client.patch(
            f'/api/payments/{payment.id}/',
            {'is_paid': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertFalse(payment.is_paid)

    def test_director_can_mark_payment_as_paid(self):
        payment = Payment.objects.create(child=self.child_1, amount='150.00', description='Czesne')
        self.client.force_authenticate(self.director)
        response = self.client.patch(
            f'/api/payments/{payment.id}/',
            {'is_paid': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertTrue(payment.is_paid)
        self.assertIsNotNone(payment.payment_date)

    def test_recurring_payment_write_requires_director(self):
        self.client.force_authenticate(self.parent_1)
        parent_response = self.client.post('/api/recurring-payments/', {
            'children': [self.child_1.id],
            'amount': '120.00',
            'description': 'Czesne cykliczne',
            'frequency': 'monthly',
            'next_payment_date': str(timezone.localdate()),
            'is_active': True,
        }, format='json')
        self.assertEqual(parent_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.director)
        director_response = self.client.post('/api/recurring-payments/', {
            'children': [self.child_1.id],
            'amount': '120.00',
            'description': 'Czesne cykliczne',
            'frequency': 'monthly',
            'next_payment_date': str(timezone.localdate()),
            'is_active': True,
        }, format='json')
        self.assertEqual(director_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RecurringPayment.objects.count(), 1)

    def test_parent_newsfeed_list_filters_public_and_own_groups(self):
        Post.objects.create(title='Public', content='P', target_group=None)
        Post.objects.create(title='GroupA', content='A', target_group=self.group_a)
        Post.objects.create(title='GroupB', content='B', target_group=self.group_b)

        self.client.force_authenticate(self.parent_1)
        response = self.client.get('/api/newsfeed/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {row['title'] for row in response.data}
        self.assertEqual(titles, {'Public', 'GroupA'})

    def test_newsfeed_write_requires_director(self):
        self.client.force_authenticate(self.parent_1)
        parent_response = self.client.post('/api/newsfeed/', {
            'title': 'Nowy post',
            'content': 'Treść',
        }, format='json')
        self.assertEqual(parent_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.director)
        director_response = self.client.post('/api/newsfeed/', {
            'title': 'Nowy post',
            'content': 'Treść',
        }, format='json')
        self.assertEqual(director_response.status_code, status.HTTP_201_CREATED)

    def test_newsfeed_like_and_comment_actions(self):
        post = Post.objects.create(title='Post', content='Treść', target_group=None)
        self.client.force_authenticate(self.parent_1)

        like_first = self.client.post(f'/api/newsfeed/{post.id}/like/', {}, format='json')
        self.assertEqual(like_first.status_code, status.HTTP_200_OK)
        self.assertTrue(like_first.data['liked'])

        like_second = self.client.post(f'/api/newsfeed/{post.id}/like/', {}, format='json')
        self.assertEqual(like_second.status_code, status.HTTP_200_OK)
        self.assertFalse(like_second.data['liked'])

        comment_response = self.client.post(
            f'/api/newsfeed/{post.id}/comment/',
            {'content': 'Komentarz'},
            format='json',
        )
        self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PostComment.objects.filter(post=post).count(), 1)

    def test_attendance_scope_parent_vs_director(self):
        Attendance.objects.create(child=self.child_1, date=timezone.now().date(), status='absent')
        Attendance.objects.create(child=self.child_2, date=timezone.localdate(), status='absent')

        self.client.force_authenticate(self.parent_1)
        parent_response = self.client.get('/api/attendance/')
        self.assertEqual(parent_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(parent_response.data), 1)

        self.client.force_authenticate(self.director)
        director_response = self.client.get('/api/attendance/')
        self.assertEqual(director_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(director_response.data), 2)

    def test_attendance_parent_cannot_add_past_absence(self):
        past_weekday = self._previous_weekday()
        self.client.force_authenticate(self.parent_1)
        response = self.client.post('/api/attendance/', {
            'child': self.child_1.id,
            'date': str(past_weekday),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_attendance_director_can_add_past_absence_on_weekday(self):
        past_weekday = self._previous_weekday()
        self.client.force_authenticate(self.director)
        response = self.client.post('/api/attendance/', {
            'child': self.child_1.id,
            'date': str(past_weekday),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_facility_closure_write_requires_director(self):
        closure_date = timezone.localdate() + timedelta(days=10)
        self.client.force_authenticate(self.parent_1)
        parent_response = self.client.post('/api/calendar/closures/', {
            'date': str(closure_date),
            'reason': 'Święto',
        }, format='json')
        self.assertEqual(parent_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.director)
        director_response = self.client.post('/api/calendar/closures/', {
            'date': str(closure_date),
            'reason': 'Święto',
        }, format='json')
        self.assertEqual(director_response.status_code, status.HTTP_201_CREATED)

    def test_special_activity_parent_filtering_by_group(self):
        activity_a = SpecialActivity.objects.create(
            title='A', description='A', date=timezone.localdate(), start_time='09:00', end_time='10:00'
        )
        activity_a.groups.add(self.group_a)

        activity_b = SpecialActivity.objects.create(
            title='B', description='B', date=timezone.localdate(), start_time='09:00', end_time='10:00'
        )
        activity_b.groups.add(self.group_b)

        self.client.force_authenticate(self.parent_1)
        response = self.client.get('/api/calendar/activities/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {row['title'] for row in response.data}
        self.assertEqual(titles, {'A'})

    def test_daily_menu_query_range_filters_data(self):
        DailyMenu.objects.create(date=date(2026, 3, 10), lunch_main_course='A')
        DailyMenu.objects.create(date=date(2026, 3, 20), lunch_main_course='B')

        self.client.force_authenticate(self.parent_1)
        response = self.client.get('/api/menu/?start_date=2026-03-01&end_date=2026-03-15')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['date'], '2026-03-10')

    def test_gallery_scope_for_parent(self):
        GalleryItem.objects.create(title='Public', description='x', target_group=None)
        GalleryItem.objects.create(title='A', description='x', target_group=self.group_a)
        GalleryItem.objects.create(title='B', description='x', target_group=self.group_b)

        self.client.force_authenticate(self.parent_1)
        response = self.client.get('/api/gallery/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {row['title'] for row in response.data}
        self.assertEqual(titles, {'Public', 'A'})

    def test_gallery_write_requires_director(self):
        self.client.force_authenticate(self.parent_1)
        parent_response = self.client.post('/api/gallery/', {
            'title': 'Album P',
            'description': 'x',
        }, format='multipart')
        self.assertEqual(parent_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.director)
        director_response = self.client.post('/api/gallery/', {
            'title': 'Album D',
            'description': 'x',
        }, format='multipart')
        self.assertEqual(director_response.status_code, status.HTTP_201_CREATED)

    def test_gallery_like_toggle(self):
        album = GalleryItem.objects.create(title='Album', description='x', target_group=None)
        self.client.force_authenticate(self.parent_1)

        first = self.client.post(f'/api/gallery/{album.id}/like/', {}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertTrue(first.data['liked'])

        second = self.client.post(f'/api/gallery/{album.id}/like/', {}, format='json')
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data['liked'])

    def test_group_write_requires_director(self):
        self.client.force_authenticate(self.parent_1)
        parent_response = self.client.post('/api/groups/', {
            'name': 'Nowa',
            'teachers_info': 'X',
        }, format='json')
        self.assertEqual(parent_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.director)
        director_response = self.client.post('/api/groups/', {
            'name': 'Nowa',
            'teachers_info': 'X',
        }, format='json')
        self.assertEqual(director_response.status_code, status.HTTP_201_CREATED)

    def test_director_stats_requires_director(self):
        reference_date = timezone.now().date()
        Message.objects.create(sender=self.parent_1, receiver=self.director, subject='M', body='B', is_read=False)
        Attendance.objects.create(child=self.child_1, date=reference_date, status='absent')

        self.client.force_authenticate(self.parent_1)
        forbidden = self.client.get('/api/director/stats/')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.director)
        fixed_now = timezone.make_aware(datetime.combine(reference_date, datetime.min.time()))
        with patch('core.views.timezone.now', return_value=fixed_now):
            ok = self.client.get('/api/director/stats/')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(ok.data['unread_messages'], 1)
        self.assertEqual(ok.data['absent_today'], 1)
        self.assertEqual(ok.data['total_children'], 2)