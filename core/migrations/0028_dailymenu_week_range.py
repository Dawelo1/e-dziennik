from datetime import timedelta

from django.db import migrations, models


def forward_fill_week_range_and_deduplicate(apps, schema_editor):
    DailyMenu = apps.get_model('core', 'DailyMenu')

    for menu in DailyMenu.objects.all().iterator():
        week_start = menu.date - timedelta(days=menu.date.weekday())
        week_end = week_start + timedelta(days=4)
        menu.week_start_date = week_start
        menu.week_end_date = week_end
        menu.save(update_fields=['week_start_date', 'week_end_date'])

    seen_weeks = set()
    for menu in DailyMenu.objects.all().order_by('-id').iterator():
        if menu.week_start_date in seen_weeks:
            menu.delete()
            continue
        seen_weeks.add(menu.week_start_date)


def backward_restore_date_from_week_start(apps, schema_editor):
    DailyMenu = apps.get_model('core', 'DailyMenu')

    for menu in DailyMenu.objects.all().iterator():
        menu.date = menu.week_start_date
        menu.save(update_fields=['date'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_dailymenu_image_upload'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailymenu',
            name='week_end_date',
            field=models.DateField(blank=True, null=True, verbose_name='Data zakończenia tygodnia'),
        ),
        migrations.AddField(
            model_name='dailymenu',
            name='week_start_date',
            field=models.DateField(blank=True, null=True, verbose_name='Data rozpoczęcia tygodnia'),
        ),
        migrations.RunPython(forward_fill_week_range_and_deduplicate, backward_restore_date_from_week_start),
        migrations.RemoveField(
            model_name='dailymenu',
            name='date',
        ),
        migrations.AlterField(
            model_name='dailymenu',
            name='week_end_date',
            field=models.DateField(verbose_name='Data zakończenia tygodnia'),
        ),
        migrations.AlterField(
            model_name='dailymenu',
            name='week_start_date',
            field=models.DateField(unique=True, verbose_name='Data rozpoczęcia tygodnia'),
        ),
    ]
