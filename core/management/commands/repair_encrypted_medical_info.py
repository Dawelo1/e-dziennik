from cryptography.exceptions import InvalidSignature
from django.core.management.base import BaseCommand
from django.core.signing import BadSignature

from core.models import Child


class Command(BaseCommand):
    help = (
        "Repairs corrupted encrypted Child.medical_info values by replacing unreadable "
        "values with an empty string encrypted using the current key."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report corrupted rows without saving changes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        checked = 0
        repaired = 0

        queryset = Child.objects.defer("medical_info").order_by("id")

        for child in queryset.iterator():
            checked += 1
            try:
                # Access triggers decrypt; if key/signature is wrong, exception is raised.
                _ = child.medical_info
            except (BadSignature, InvalidSignature):
                repaired += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Corrupted medical_info detected for Child id={child.id}"
                    )
                )
                if not dry_run:
                    child.medical_info = ""
                    child.save(update_fields=["medical_info"])

        if dry_run:
            self.stdout.write(
                self.style.NOTICE(
                    f"Dry-run complete. Checked {checked} records; {repaired} need repair."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Repair complete. Checked {checked} records; repaired {repaired}."
            )
        )
