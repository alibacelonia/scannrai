from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse


class ScanCreateRateLimitMiddleware:
    """Simple IP-based throttle for scan creation requests."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_scan_create_request(request):
            limit = int(getattr(settings, 'SCAN_CREATE_IP_RATE_LIMIT_PER_MINUTE', 60))
            if limit > 0:
                ip = self._client_ip(request)
                cache_key = f'scan-create:{ip}:{self._minute_bucket()}'
                current = int(cache.get(cache_key, 0)) + 1
                cache.set(cache_key, current, timeout=65)
                if current > limit:
                    return JsonResponse(
                        {'detail': 'Too many scan creation requests from this client. Try again shortly.'},
                        status=429,
                    )

        return self.get_response(request)

    @staticmethod
    def _is_scan_create_request(request) -> bool:
        if request.method != 'POST':
            return False
        path = request.path.rstrip('/')
        return path.startswith('/api/projects/') and path.endswith('/scans')

    @staticmethod
    def _client_ip(request) -> str:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')

    @staticmethod
    def _minute_bucket() -> int:
        import time

        return int(time.time() // 60)
