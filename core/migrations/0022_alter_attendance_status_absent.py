from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_normalize_attendance_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='attendance',
            name='status',
            field=models.CharField(
                choices=[('absent', 'Nieobecny (Zgłoszone)')],
                default='absent',
                max_length=10,
            ),
        ),
    ]
