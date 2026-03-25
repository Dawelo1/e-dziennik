from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('communication', '0003_remove_legacy_conversationreadstate'),
    ]

    operations = [
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS communication_conversationfollowupstate;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
