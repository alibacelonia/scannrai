from django.core.management.base import BaseCommand

from apps.scans.services import recover_stale_running_scans


class Command(BaseCommand):
    help = "Mark stale running scans as failed so they can be safely re-queued."

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout-seconds",
            type=int,
            default=None,
            help="Override stale running timeout in seconds.",
        )
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Suppress normal output.",
        )

    def handle(self, *args, **options):
        recovered = recover_stale_running_scans(timeout_seconds=options.get("timeout_seconds"))
        if not options.get("quiet"):
            self.stdout.write(self.style.SUCCESS(f"Recovered {recovered} stale running scan(s)."))
