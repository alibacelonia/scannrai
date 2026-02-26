import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings

from apps.scans.security import redact_text, truncate_text

TOOL_SEMGREP = 'semgrep'
TOOL_OSV = 'osv'
TOOL_GITLEAKS = 'gitleaks'


@dataclass(slots=True)
class RunOptions:
    timeout_seconds: int
    max_log_chars: int
    memory_limit_mb: int
    cpu_time_seconds: int


def _build_preexec_fn(options: RunOptions):
    if options.memory_limit_mb <= 0 and options.cpu_time_seconds <= 0:
        return None

    def _apply_limits() -> None:
        try:
            import resource
        except Exception:
            return

        if options.memory_limit_mb > 0:
            try:
                memory_bytes = int(options.memory_limit_mb) * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
            except Exception:
                pass
        if options.cpu_time_seconds > 0:
            try:
                resource.setrlimit(resource.RLIMIT_CPU, (int(options.cpu_time_seconds), int(options.cpu_time_seconds)))
            except Exception:
                pass

    return _apply_limits


def _safe_run(command: list[str], cwd: Path, options: RunOptions) -> dict:
    started = time.monotonic()
    preexec_fn = _build_preexec_fn(options)

    try:
        process = subprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=options.timeout_seconds,
            check=False,
            preexec_fn=preexec_fn,
        )
        stdout = truncate_text(redact_text(process.stdout or ''), options.max_log_chars)
        stderr = truncate_text(redact_text(process.stderr or ''), options.max_log_chars)
        return {
            'exit_code': process.returncode,
            'stdout': stdout,
            'stderr': stderr,
            'timed_out': False,
            'error': None,
            'duration_seconds': round(time.monotonic() - started, 3),
        }
    except subprocess.TimeoutExpired as exc:
        stdout = truncate_text(redact_text(exc.stdout or ''), options.max_log_chars)
        stderr = truncate_text(redact_text(exc.stderr or ''), options.max_log_chars)
        return {
            'exit_code': None,
            'stdout': stdout,
            'stderr': stderr,
            'timed_out': True,
            'error': f'Command timed out after {options.timeout_seconds}s',
            'duration_seconds': round(time.monotonic() - started, 3),
        }
    except FileNotFoundError as exc:
        return {
            'exit_code': None,
            'stdout': '',
            'stderr': '',
            'timed_out': False,
            'error': str(exc),
            'duration_seconds': round(time.monotonic() - started, 3),
        }


def _write_json_payload(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def _write_stdout_or_error(path: Path, run_result: dict) -> None:
    if run_result['stdout']:
        try:
            parsed = json.loads(run_result['stdout'])
            _write_json_payload(path, parsed)
            return
        except json.JSONDecodeError:
            pass

    error_payload = {
        'error': run_result['error'] or run_result['stderr'] or 'No output produced',
        'timed_out': run_result['timed_out'],
        'exit_code': run_result['exit_code'],
    }
    _write_json_payload(path, error_payload)


class BaseRunner:
    tool_name = ''

    def run(self, repo_dir: Path, output_dir: Path, options: RunOptions) -> dict:
        raise NotImplementedError


class SemgrepRunner(BaseRunner):
    tool_name = TOOL_SEMGREP

    def run(self, repo_dir: Path, output_dir: Path, options: RunOptions) -> dict:
        output_path = output_dir / 'semgrep.json'
        command = [
            'semgrep',
            'scan',
            '--config',
            'p/security-audit',
            '--json',
            '--output',
            str(output_path),
            str(repo_dir),
        ]
        result = _safe_run(command, cwd=repo_dir, options=options)
        if not output_path.exists():
            _write_stdout_or_error(output_path, result)

        return {
            'command': command,
            'exit_code': result['exit_code'],
            'timed_out': result['timed_out'],
            'error': result['error'],
            'stdout': result['stdout'],
            'stderr': result['stderr'],
            'duration_seconds': result['duration_seconds'],
            'output_path': str(output_path),
        }


class OsvRunner(BaseRunner):
    tool_name = TOOL_OSV

    def run(self, repo_dir: Path, output_dir: Path, options: RunOptions) -> dict:
        output_path = output_dir / 'osv-scanner.json'
        command = ['osv-scanner', '--format=json', '--recursive', '.']
        result = _safe_run(command, cwd=repo_dir, options=options)

        if result['stdout']:
            try:
                parsed = json.loads(result['stdout'])
                _write_json_payload(output_path, parsed)
            except json.JSONDecodeError:
                _write_stdout_or_error(output_path, result)
        else:
            _write_stdout_or_error(output_path, result)

        return {
            'command': command,
            'exit_code': result['exit_code'],
            'timed_out': result['timed_out'],
            'error': result['error'],
            'stdout': result['stdout'],
            'stderr': result['stderr'],
            'duration_seconds': result['duration_seconds'],
            'output_path': str(output_path),
        }


class GitleaksRunner(BaseRunner):
    tool_name = TOOL_GITLEAKS

    def run(self, repo_dir: Path, output_dir: Path, options: RunOptions) -> dict:
        output_path = output_dir / 'gitleaks.json'
        command = [
            'gitleaks',
            'detect',
            '--source',
            '.',
            '--report-format',
            'json',
            '--report-path',
            str(output_path),
            '--no-banner',
        ]
        result = _safe_run(command, cwd=repo_dir, options=options)
        if not output_path.exists():
            _write_stdout_or_error(output_path, result)

        return {
            'command': command,
            'exit_code': result['exit_code'],
            'timed_out': result['timed_out'],
            'error': result['error'],
            'stdout': result['stdout'],
            'stderr': result['stderr'],
            'duration_seconds': result['duration_seconds'],
            'output_path': str(output_path),
        }


def _default_run_options(timeout_seconds: int) -> RunOptions:
    return RunOptions(
        timeout_seconds=max(1, timeout_seconds),
        max_log_chars=int(getattr(settings, 'SCAN_TOOL_LOG_MAX_CHARS', 4000)),
        memory_limit_mb=int(getattr(settings, 'SCAN_TOOL_MEMORY_LIMIT_MB', 2048)),
        cpu_time_seconds=int(getattr(settings, 'SCAN_TOOL_CPU_TIME_SECONDS', timeout_seconds)),
    )


def run_semgrep(repo_dir: Path, output_dir: Path, timeout_seconds: int) -> dict:
    return SemgrepRunner().run(repo_dir, output_dir, _default_run_options(timeout_seconds=timeout_seconds))


def run_osv_scanner(repo_dir: Path, output_dir: Path, timeout_seconds: int) -> dict:
    return OsvRunner().run(repo_dir, output_dir, _default_run_options(timeout_seconds=timeout_seconds))


def run_gitleaks(repo_dir: Path, output_dir: Path, timeout_seconds: int) -> dict:
    return GitleaksRunner().run(repo_dir, output_dir, _default_run_options(timeout_seconds=timeout_seconds))


def detect_tool_versions(repo_dir: Path) -> dict[str, str]:
    commands = {
        TOOL_SEMGREP: ['semgrep', '--version'],
        TOOL_OSV: ['osv-scanner', '--version'],
        TOOL_GITLEAKS: ['gitleaks', 'version'],
    }
    versions: dict[str, str] = {}
    options = _default_run_options(timeout_seconds=10)
    for tool, command in commands.items():
        result = _safe_run(command, cwd=repo_dir, options=options)
        output = (result.get('stdout') or result.get('stderr') or '').strip().splitlines()
        versions[tool] = output[0] if output else 'unknown'
    return versions


def run_all_tools(
    scan_id: int,
    repo_dir: Path,
    *,
    enabled_tools: list[str] | None = None,
    tool_timeouts: dict[str, int] | None = None,
) -> tuple[dict, dict]:
    output_dir = Path(settings.SCAN_WORKDIR) / str(scan_id) / 'tool-outputs'
    output_dir.mkdir(parents=True, exist_ok=True)

    timeout_map = dict(tool_timeouts or {})
    default_timeout = int(settings.SCAN_TOOL_TIMEOUT_SECONDS)

    runners: list[BaseRunner] = [SemgrepRunner(), OsvRunner(), GitleaksRunner()]
    enabled_set = set(enabled_tools or [TOOL_SEMGREP, TOOL_OSV, TOOL_GITLEAKS])

    tool_results: dict[str, dict] = {}
    output_paths: dict[str, str] = {}

    for runner in runners:
        if runner.tool_name not in enabled_set:
            tool_results[runner.tool_name] = {
                'command': [],
                'exit_code': 0,
                'timed_out': False,
                'error': None,
                'stdout': '',
                'stderr': '',
                'duration_seconds': 0,
                'skipped': True,
                'output_path': '',
            }
            continue

        timeout = int(timeout_map.get(runner.tool_name, default_timeout))
        options = _default_run_options(timeout_seconds=timeout)
        result = runner.run(repo_dir, output_dir, options)
        tool_results[runner.tool_name] = result
        output_paths[runner.tool_name] = result['output_path']

    return tool_results, output_paths
