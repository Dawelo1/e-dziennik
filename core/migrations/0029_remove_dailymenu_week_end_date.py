from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0028_dailymenu_week_range'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='dailymenu',
            name='week_end_date',
        ),
    ]
