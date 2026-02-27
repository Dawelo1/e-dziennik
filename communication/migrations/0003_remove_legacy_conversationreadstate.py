from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('communication', '0002_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS communication_conversationreadstate;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
