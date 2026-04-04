from django.core.management.base import BaseCommand

from users.email_notifications import send_due_parent_email_notifications


class Command(BaseCommand):
    help = 'Kompatybilna komenda serwisowa (obecnie e-maile są wysyłane od razu po zdarzeniu).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=500,
            help='Maksymalna liczba rekordów do przetworzenia w jednym uruchomieniu.',
        )

    def handle(self, *args, **options):
        limit = max(1, int(options.get('limit') or 500))
        result = send_due_parent_email_notifications(limit=limit)

        self.stdout.write(
            self.style.SUCCESS(
                (
                    'Powiadomienia e-mail: '
                    f"processed={result['processed']} sent={result['sent']} "
                    f"skipped={result['skipped']} failed={result['failed']}"
                )
            )
        )
