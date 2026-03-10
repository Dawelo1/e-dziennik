from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_non_negative_payment_amounts'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='meal_period',
            field=models.DateField(blank=True, null=True, verbose_name='Okres rozliczeniowy wyżywienia (1. dzień miesiąca)'),
        ),
        migrations.AddConstraint(
            model_name='payment',
            constraint=models.UniqueConstraint(condition=models.Q(('meal_period__isnull', False)), fields=('child', 'meal_period'), name='unique_meal_payment_per_child_period'),
        ),
    ]
