from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_child_uses_meals'),
    ]

    operations = [
        migrations.AlterField(
            model_name='child',
            name='uses_meals',
            field=models.BooleanField(default=False, verbose_name='Korzysta z posiłków'),
        ),
    ]
