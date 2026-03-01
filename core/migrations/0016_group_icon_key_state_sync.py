from django.db import migrations, models


def add_icon_key_if_missing(apps, schema_editor):
	table_name = 'core_group'
	with schema_editor.connection.cursor() as cursor:
		description = schema_editor.connection.introspection.get_table_description(cursor, table_name)
		existing_columns = {column.name for column in description}
		if 'icon_key' not in existing_columns:
			schema_editor.execute(
				"ALTER TABLE core_group ADD COLUMN icon_key varchar(50) NOT NULL DEFAULT 'group'"
			)


class Migration(migrations.Migration):

	dependencies = [
		('core', '0015_child_meal_rate'),
	]

	operations = [
		migrations.SeparateDatabaseAndState(
			database_operations=[
				migrations.RunPython(add_icon_key_if_missing, migrations.RunPython.noop),
			],
			state_operations=[
				migrations.AddField(
					model_name='group',
					name='icon_key',
					field=models.CharField(default='group', max_length=50, verbose_name='Klucz ikony'),
				),
			],
		),
	]
