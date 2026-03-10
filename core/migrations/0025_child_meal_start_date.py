from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_alter_child_uses_meals_default_false'),
    ]

    operations = [
        migrations.AddField(
            model_name='child',
            name='meal_start_date',
            field=models.DateField(blank=True, null=True, verbose_name='Data rozpoczęcia wyżywienia'),
        ),
    ]
