#!/usr/bin/env sh
set -e

python manage.py migrate --noinput

if [ -n "${BOOTSTRAP_DIRECTOR_USERNAME:-}" ] && [ -n "${BOOTSTRAP_DIRECTOR_PASSWORD:-}" ]; then
python manage.py shell <<'PY'
import os
from users.models import User

username = os.environ.get('BOOTSTRAP_DIRECTOR_USERNAME')
password = os.environ.get('BOOTSTRAP_DIRECTOR_PASSWORD')
email = os.environ.get('BOOTSTRAP_DIRECTOR_EMAIL', '')

user, _ = User.objects.get_or_create(username=username, defaults={'email': email})

changed = False
if email and user.email != email:
	user.email = email
	changed = True

if not user.check_password(password):
	user.set_password(password)
	changed = True

if not user.is_staff:
	user.is_staff = True
	changed = True

if not user.is_superuser:
	user.is_superuser = True
	changed = True

if not user.is_director:
	user.is_director = True
	changed = True

if user.is_parent:
	user.is_parent = False
	changed = True

if changed:
	user.save()
PY
fi

exec daphne -b 0.0.0.0 -p "${PORT:-10000}" config.asgi:application
