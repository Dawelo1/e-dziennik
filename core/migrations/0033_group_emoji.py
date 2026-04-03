from django.db import migrations, models


def extract_group_emoji(apps, schema_editor):
    Group = apps.get_model('core', 'Group')

    for group in Group.objects.all():
        original_name = (group.name or '').strip()
        if not original_name:
            continue

        index = 0
        while index < len(original_name) and not original_name[index].isalnum():
            index += 1

        if index == 0:
            continue

        emoji = original_name[:index].strip()
        clean_name = original_name[index:].strip()

        if not emoji or not clean_name:
            continue

        group.emoji = emoji[:16]
        group.name = clean_name
        group.save(update_fields=['emoji', 'name'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_preschool_bank_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='emoji',
            field=models.CharField(blank=True, default='', max_length=16, verbose_name='Emoji grupy'),
        ),
        migrations.RunPython(extract_group_emoji, migrations.RunPython.noop),
    ]
