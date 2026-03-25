from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_recurringpayment_children'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailymenu',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='menu/%Y/%m/', verbose_name='Zdjęcie jadłospisu'),
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='allergens',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='breakfast_beverage',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='breakfast_fruit',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='breakfast_main_course',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='breakfast_soup',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='fruit_break',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='lunch_beverage',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='lunch_fruit',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='lunch_main_course',
        ),
        migrations.RemoveField(
            model_name='dailymenu',
            name='lunch_soup',
        ),
        migrations.AlterModelOptions(
            name='dailymenu',
            options={'ordering': ['-date'], 'verbose_name': 'Jadłospis (zdjęcie)', 'verbose_name_plural': 'Jadłospis'},
        ),
    ]
