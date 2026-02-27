from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_director_password_preview_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='last_seen_schedule_activity_id',
            field=models.PositiveIntegerField(default=0, verbose_name='Ostatnio widziane zajęcia (ID)'),
        ),
        migrations.AddField(
            model_name='user',
            name='last_seen_gallery_item_id',
            field=models.PositiveIntegerField(default=0, verbose_name='Ostatnio widziana galeria (ID)'),
        ),
        migrations.AddField(
            model_name='user',
            name='last_seen_calendar_closure_id',
            field=models.PositiveIntegerField(default=0, verbose_name='Ostatnio widziany kalendarz (ID)'),
        ),
        migrations.AddField(
            model_name='user',
            name='last_seen_payment_id',
            field=models.PositiveIntegerField(default=0, verbose_name='Ostatnio widziane płatności (ID)'),
        ),
    ]
