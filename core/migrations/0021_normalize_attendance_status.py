from django.db import migrations


def normalize_attendance_status(apps, schema_editor):
    Attendance = apps.get_model('core', 'Attendance')
    Attendance.objects.filter(status='nieobecny').update(status='absent')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_payment_meal_period_unique'),
    ]

    operations = [
        migrations.RunPython(normalize_attendance_status, migrations.RunPython.noop),
    ]
