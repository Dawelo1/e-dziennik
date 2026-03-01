from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_group_icon_key_state_sync'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='group',
            name='icon_key',
        ),
    ]
