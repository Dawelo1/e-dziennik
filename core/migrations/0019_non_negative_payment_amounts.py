from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0018_group_color_key'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='amount',
            field=models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(0)], verbose_name='Kwota'),
        ),
        migrations.AlterField(
            model_name='recurringpayment',
            name='amount',
            field=models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(0)], verbose_name='Kwota'),
        ),
        migrations.AddConstraint(
            model_name='payment',
            constraint=models.CheckConstraint(check=models.Q(amount__gte=0), name='payment_amount_gte_0'),
        ),
        migrations.AddConstraint(
            model_name='recurringpayment',
            constraint=models.CheckConstraint(check=models.Q(amount__gte=0), name='recurring_payment_amount_gte_0'),
        ),
    ]
