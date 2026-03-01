from django.db import migrations, models


def assign_initial_group_colors(apps, schema_editor):
    Group = apps.get_model('core', 'Group')
    color_pool = ['red', 'yellow', 'blue', 'green', 'orange', 'purple']

    groups = Group.objects.order_by('id')
    for index, group in enumerate(groups):
        if group.color_key:
            continue
        group.color_key = color_pool[index % len(color_pool)]
        group.save(update_fields=['color_key'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_remove_group_icon_key'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='color_key',
            field=models.CharField(blank=True, choices=[('red', 'Czerwony'), ('yellow', 'Żółty'), ('blue', 'Niebieski'), ('green', 'Zielony'), ('orange', 'Pomarańczowy'), ('purple', 'Fioletowy')], editable=False, max_length=20, null=True, verbose_name='Kolor grupy'),
        ),
        migrations.RunPython(assign_initial_group_colors, migrations.RunPython.noop),
    ]
