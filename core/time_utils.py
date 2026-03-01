from __future__ import annotations

from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone


TEST_CLOCK_CACHE_KEY = "debug_test_clock_override_iso"


def is_test_clock_enabled() -> bool:
    return bool(getattr(settings, "ENABLE_TEST_CLOCK", False) and settings.DEBUG)


def get_time_override() -> datetime | None:
    if not is_test_clock_enabled():
        return None

    raw_value = cache.get(TEST_CLOCK_CACHE_KEY)
    if not raw_value:
        return None

    try:
        parsed = datetime.fromisoformat(raw_value)
    except (TypeError, ValueError):
        return None

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    return parsed


def set_time_override(new_datetime: datetime) -> datetime:
    if timezone.is_naive(new_datetime):
        new_datetime = timezone.make_aware(new_datetime, timezone.get_current_timezone())

    cache.set(TEST_CLOCK_CACHE_KEY, new_datetime.isoformat(), timeout=None)
    return new_datetime


def clear_time_override() -> None:
    cache.delete(TEST_CLOCK_CACHE_KEY)


def now() -> datetime:
    return get_time_override() or timezone.now()


def today():
    return now().date()
