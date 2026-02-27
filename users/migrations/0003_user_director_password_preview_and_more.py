from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_avatar'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='director_password_preview',
            field=models.CharField(blank=True, max_length=128, null=True, verbose_name='Podgląd hasła dla dyrektora'),
        ),
        migrations.AddField(
            model_name='user',
            name='director_password_preview_active',
            field=models.BooleanField(default=False, verbose_name='Podgląd hasła aktywny'),
        ),
    ]
