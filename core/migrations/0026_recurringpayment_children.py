from django.db import migrations, models


def forward_copy_child_to_children(apps, schema_editor):
    RecurringPayment = apps.get_model('core', 'RecurringPayment')

    for recurring in RecurringPayment.objects.all().iterator():
        if recurring.child_id:
            recurring.children.add(recurring.child_id)


def backward_copy_children_to_child(apps, schema_editor):
    RecurringPayment = apps.get_model('core', 'RecurringPayment')

    for recurring in RecurringPayment.objects.all().iterator():
        first_child = recurring.children.order_by('id').first()
        if first_child:
            recurring.child_id = first_child.id
            recurring.save(update_fields=['child'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_child_meal_start_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='recurringpayment',
            name='children',
            field=models.ManyToManyField(related_name='recurring_payment_templates', to='core.child', verbose_name='Dzieci'),
        ),
        migrations.RunPython(forward_copy_child_to_children, backward_copy_children_to_child),
        migrations.RemoveField(
            model_name='recurringpayment',
            name='child',
        ),
    ]
