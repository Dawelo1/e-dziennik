from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_alter_attendance_status_absent'),
    ]

    operations = [
        migrations.AddField(
            model_name='child',
            name='uses_meals',
            field=models.BooleanField(default=True, verbose_name='Korzysta z posiłków'),
        ),
    ]
