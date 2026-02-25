import json
import subprocess
import time
from pathlib import Path

from django.conf import settings


def _safe_run(command: list[str], cwd: Path, timeout_seconds: int) -> dict:
    started = time.monotonic()
    try:
        process = subprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
        return {
            'exit_code': process.returncode,
            'stdout': process.stdout,
            'stderr': process.stderr,
            'timed_out': False,
            'error': None,
            'duration_seconds': round(time.monotonic() - started, 3),
        }
    except subprocess.TimeoutExpired as exc:
        return {
            'exit_code': None,
            'stdout': exc.stdout or '',
            'stderr': exc.stderr or '',
            'timed_out': True,
            'error': f'Command timed out after {timeout_seconds}s',
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


def _write_json_payload(path: Path, payload: dict) -> None:
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


def run_semgrep(repo_dir: Path, output_dir: Path, timeout_seconds: int) -> dict:
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
    result = _safe_run(command, cwd=repo_dir, timeout_seconds=timeout_seconds)

    if not output_path.exists():
        _write_stdout_or_error(output_path, result)

    return {
        'command': command,
        'exit_code': result['exit_code'],
        'timed_out': result['timed_out'],
        'error': result['error'],
        'duration_seconds': result['duration_seconds'],
        'output_path': str(output_path),
    }


def run_osv_scanner(repo_dir: Path, output_dir: Path, timeout_seconds: int) -> dict:
    output_path = output_dir / 'osv-scanner.json'
    command = ['osv-scanner', '--format=json', '--recursive', '.']
    result = _safe_run(command, cwd=repo_dir, timeout_seconds=timeout_seconds)

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
        'duration_seconds': result['duration_seconds'],
        'output_path': str(output_path),
    }


def run_gitleaks(repo_dir: Path, output_dir: Path, timeout_seconds: int) -> dict:
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
    result = _safe_run(command, cwd=repo_dir, timeout_seconds=timeout_seconds)

    if not output_path.exists():
        _write_stdout_or_error(output_path, result)

    return {
        'command': command,
        'exit_code': result['exit_code'],
        'timed_out': result['timed_out'],
        'error': result['error'],
        'duration_seconds': result['duration_seconds'],
        'output_path': str(output_path),
    }


def run_all_tools(scan_id: int, repo_dir: Path) -> tuple[dict, dict]:
    output_dir = Path(settings.SCAN_WORKDIR) / str(scan_id) / 'tool-outputs'
    output_dir.mkdir(parents=True, exist_ok=True)

    timeout_seconds = int(settings.SCAN_TOOL_TIMEOUT_SECONDS)

    semgrep_result = run_semgrep(repo_dir, output_dir, timeout_seconds)
    osv_result = run_osv_scanner(repo_dir, output_dir, timeout_seconds)
    gitleaks_result = run_gitleaks(repo_dir, output_dir, timeout_seconds)

    tool_results = {
        'semgrep': semgrep_result,
        'osv': osv_result,
        'gitleaks': gitleaks_result,
    }
    output_paths = {
        'semgrep': semgrep_result['output_path'],
        'osv': osv_result['output_path'],
        'gitleaks': gitleaks_result['output_path'],
    }
    return tool_results, output_paths
