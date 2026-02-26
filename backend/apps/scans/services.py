import hashlib
import os
import shutil
import subprocess
import tempfile
import time
import zipfile
from datetime import timedelta
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

from django.conf import settings
from django.utils import timezone

from dulwich import porcelain
from dulwich.repo import Repo

from .models import Scan
from .security import stable_json_hash


def _workspace_dir(scan_id: int) -> Path:
    return Path(settings.SCAN_WORKDIR) / str(scan_id)


def _shared_upload_dir() -> Path:
    return Path(settings.SCAN_SHARED_UPLOAD_DIR)


def _repo_dir(scan_id: int) -> Path:
    return _workspace_dir(scan_id) / 'repo'


def _ensure_workspace(scan_id: int) -> tuple[Path, Path]:
    workspace_dir = _workspace_dir(scan_id)
    repo_dir = _repo_dir(scan_id)
    repo_dir.mkdir(parents=True, exist_ok=True)
    return workspace_dir, repo_dir


def _save_uploaded_file(uploaded_file, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('wb') as target:
        for chunk in uploaded_file.chunks():
            target.write(chunk)


def _safe_extract_zip(zip_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()
    with zipfile.ZipFile(zip_path, 'r') as archive:
        max_file_count = int(getattr(settings, 'SCAN_ZIP_MAX_FILES', 20000))
        max_uncompressed_bytes = int(getattr(settings, 'SCAN_ZIP_MAX_BYTES', 500 * 1024 * 1024))
        if len(archive.infolist()) > max_file_count:
            raise ValueError(f'Zip archive has too many files (limit: {max_file_count}).')

        total_size = 0
        for member in archive.infolist():
            extracted_path = (destination / member.filename).resolve()
            if extracted_path != destination_root and destination_root not in extracted_path.parents:
                raise ValueError('Zip archive contains invalid paths.')
            total_size += int(member.file_size or 0)
            if total_size > max_uncompressed_bytes:
                raise ValueError(
                    'Zip archive is too large after decompression '
                    f'(limit: {max_uncompressed_bytes} bytes).'
                )
        archive.extractall(destination)


def _compute_tree_checksum(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        relative_path = str(path.relative_to(root))
        digest.update(relative_path.encode('utf-8'))
        if path.is_file():
            with path.open('rb') as file_obj:
                while True:
                    chunk = file_obj.read(8192)
                    if not chunk:
                        break
                    digest.update(chunk)
        elif path.is_symlink():
            try:
                digest.update(f"symlink->{os.readlink(path)}".encode('utf-8'))
            except OSError:
                digest.update(b'symlink->unreadable')
    return digest.hexdigest()


def _normalize_repo_relative_path(raw_path: str) -> Path:
    normalized = raw_path.replace('\\', '/').strip()
    if not normalized:
        raise ValueError('Folder upload contains an empty file path.')

    normalized = normalized.lstrip('/')
    path = PurePosixPath(normalized)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('Folder upload contains invalid paths.')
    if any(part in ('', '.') for part in path.parts):
        raise ValueError('Folder upload contains invalid paths.')

    return Path(*path.parts)


def _ingest_from_folder_files(scan: Scan, repo_files, repo_paths) -> tuple[str | None, dict]:
    if not repo_files:
        raise ValueError('No files were provided for folder upload.')
    if len(repo_files) != len(repo_paths):
        raise ValueError('Folder upload file list is invalid.')

    workspace_dir, repo_dir = _ensure_workspace(scan.id)
    repo_root = repo_dir.resolve()

    for uploaded_file, raw_path in zip(repo_files, repo_paths):
        relative_path = _normalize_repo_relative_path(raw_path)
        destination = (repo_dir / relative_path).resolve()
        if destination != repo_root and repo_root not in destination.parents:
            raise ValueError('Folder upload contains invalid paths.')
        _save_uploaded_file(uploaded_file, destination)

    checksum = _compute_tree_checksum(repo_dir)
    meta = {
        'source': 'folder',
        'snapshot_checksum': checksum,
        'workspace_dir': str(workspace_dir),
        'repo_dir': str(repo_dir),
        'file_count': len(repo_files),
    }
    return None, meta


def _ingest_from_zip(scan: Scan, zip_file) -> tuple[str | None, dict]:
    workspace_dir, repo_dir = _ensure_workspace(scan.id)
    archive_path = workspace_dir / 'snapshot.zip'
    _save_uploaded_file(zip_file, archive_path)
    _safe_extract_zip(archive_path, repo_dir)
    checksum = _compute_tree_checksum(repo_dir)

    meta = {
        'source': 'zip',
        'snapshot_checksum': checksum,
        'workspace_dir': str(workspace_dir),
        'repo_dir': str(repo_dir),
    }
    return None, meta


def _looks_like_url(reference: str) -> bool:
    parsed = urlparse(reference)
    if parsed.scheme in ('http', 'https', 'ssh', 'git'):
        return True
    if parsed.scheme and parsed.netloc:
        return True
    return False


def _validate_remote_git_reference(reference: str) -> str:
    parsed = urlparse(reference)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError('Remote repository URL must use http or https scheme.')
    if parsed.username or parsed.password:
        raise ValueError('Remote repository URL must not contain embedded credentials.')
    if not parsed.netloc:
        raise ValueError('Remote repository URL is invalid.')
    return reference


def validate_repository_source_reference(reference: str) -> dict[str, str]:
    normalized = (reference or '').strip()
    if not normalized:
        raise ValueError('Repository source is required.')

    local_path = _resolve_local_source_path(normalized)
    if local_path.exists():
        if local_path.is_dir():
            if not (local_path / '.git').exists():
                raise ValueError('Local directory source must be a git repository (missing .git).')
            return {'kind': 'local_git', 'resolved_path': str(local_path)}
        if local_path.is_file() and local_path.suffix.lower() == '.zip':
            if not zipfile.is_zipfile(local_path):
                raise ValueError('Local zip source is not a valid .zip archive.')
            return {'kind': 'local_zip', 'resolved_path': str(local_path)}
        raise ValueError('Local repository source must be a git directory or a .zip archive.')

    if _looks_like_url(normalized):
        return {'kind': 'remote_git', 'reference': _validate_remote_git_reference(normalized)}

    mount_path = str(getattr(settings, 'LOCAL_REPO_MOUNT_PATH', '') or '/host/home').strip() or '/host/home'
    raise ValueError(
        'Repository source path is not accessible from scanner runtime: '
        f'{normalized}. '
        f'Use a full container-visible path under {mount_path} '
        '(for example: /host/home/personal-projects/<repo-folder>).'
    )


def discover_local_source_candidates(folder_name: str, max_results: int = 10, max_depth: int = 5) -> list[str]:
    target_name = Path((folder_name or '').strip()).name
    if not target_name:
        return []

    mount_root = Path(str(getattr(settings, 'LOCAL_REPO_MOUNT_PATH', '') or '/host/home')).expanduser()
    if not mount_root.exists() or not mount_root.is_dir():
        return []

    preferred_roots = []
    for relative in ('personal-projects', 'projects', 'code', 'dev', 'workspace'):
        candidate = mount_root / relative
        if candidate.exists() and candidate.is_dir():
            preferred_roots.append(candidate)
    if not preferred_roots:
        preferred_roots = [mount_root]

    ignored_dirs = {
        '.git',
        'node_modules',
        '__pycache__',
        '.cache',
        '.Trash',
        'Library',
        'Applications',
    }
    candidates: list[str] = []
    seen: set[str] = set()

    for base_root in preferred_roots:
        base_depth = len(base_root.parts)
        for current_root, dirnames, filenames in os.walk(base_root, topdown=True):
            current_path = Path(current_root)
            depth = len(current_path.parts) - base_depth
            if depth > max_depth:
                dirnames[:] = []
                continue

            dirnames[:] = [name for name in dirnames if name not in ignored_dirs]

            if current_path.name == target_name and (current_path / '.git').is_dir():
                value = str(current_path)
                if value not in seen:
                    seen.add(value)
                    candidates.append(value)
                    if len(candidates) >= max_results:
                        return sorted(candidates)

            zip_name = f'{target_name}.zip'
            if zip_name in filenames:
                zip_path = str(current_path / zip_name)
                if zip_path not in seen:
                    seen.add(zip_path)
                    candidates.append(zip_path)
                    if len(candidates) >= max_results:
                        return sorted(candidates)

    return sorted(candidates)


def _resolve_local_source_path(reference: str) -> Path:
    candidate = Path(reference).expanduser()
    if candidate.exists():
        return candidate

    host_home = str(getattr(settings, 'LOCAL_REPO_HOST_HOME', '') or '').strip()
    mount_path = str(getattr(settings, 'LOCAL_REPO_MOUNT_PATH', '') or '').strip()
    if host_home and mount_path and reference.startswith(host_home):
        relative = reference[len(host_home):].lstrip('/\\')
        mapped = Path(mount_path) / Path(relative)
        if mapped.exists():
            return mapped

    return candidate


def _ingest_from_local_git_directory(scan: Scan, source_dir: Path) -> tuple[str | None, dict]:
    if not (source_dir / '.git').exists():
        raise ValueError('Local directory source must be a git repository (missing .git).')

    workspace_dir, repo_dir = _ensure_workspace(scan.id)
    # Preserve symlinks as symlinks so broken/generated links do not fail ingestion.
    shutil.copytree(
        source_dir,
        repo_dir,
        dirs_exist_ok=True,
        symlinks=True,
        ignore=shutil.ignore_patterns('.git'),
    )

    commit_result = subprocess.run(
        ['git', '-C', str(source_dir), 'rev-parse', 'HEAD'],
        capture_output=True,
        text=True,
    )
    if commit_result.returncode != 0:
        raise ValueError('Unable to read commit hash from local git repository.')

    checksum = _compute_tree_checksum(repo_dir)
    meta = {
        'source': 'local_git',
        'local_path': str(source_dir),
        'snapshot_checksum': checksum,
        'workspace_dir': str(workspace_dir),
        'repo_dir': str(repo_dir),
    }
    return commit_result.stdout.strip(), meta


def _ingest_from_local_zip_path(scan: Scan, zip_path: Path) -> tuple[str | None, dict]:
    if not zipfile.is_zipfile(zip_path):
        raise ValueError('Local zip source is not a valid .zip archive.')
    commit_hash, meta = ingest_scan_from_zip_path(scan, zip_path)
    merged_meta = {
        **meta,
        'source': 'local_zip',
        'local_path': str(zip_path),
    }
    return commit_hash, merged_meta


def _ingest_from_git_reference(scan: Scan, reference: str) -> tuple[str | None, dict]:
    workspace_dir, repo_dir = _ensure_workspace(scan.id)
    clone_mode = 'shallow'
    reference = _validate_remote_git_reference(reference)

    clone_result = subprocess.run(
        ['git', 'clone', '--depth', '1', reference, str(repo_dir)],
        capture_output=True,
        text=True,
    )
    if clone_result.returncode == 0:
        commit_result = subprocess.run(
            ['git', '-C', str(repo_dir), 'rev-parse', 'HEAD'],
            capture_output=True,
            text=True,
            check=True,
        )
        commit_hash = commit_result.stdout.strip()
    else:
        clone_mode = 'full-fallback'
        shutil.rmtree(repo_dir, ignore_errors=True)
        repo_dir.mkdir(parents=True, exist_ok=True)
        porcelain.clone(reference, str(repo_dir), checkout=True)
        repo = Repo(str(repo_dir))
        commit_hash = repo.head().decode('utf-8')

    meta = {
        'source': 'git',
        'repo_url': reference,
        'clone_mode': clone_mode,
        'workspace_dir': str(workspace_dir),
        'repo_dir': str(repo_dir),
    }
    return commit_hash, meta


def _ingest_from_reference(scan: Scan) -> tuple[str | None, dict]:
    reference = (scan.project.repo_url or '').strip()
    if not reference:
        raise ValueError('No repository source provided. Set a repository source path or URL on the project.')

    local_path = _resolve_local_source_path(reference)
    if local_path.exists():
        if local_path.is_dir():
            return _ingest_from_local_git_directory(scan, local_path)
        if local_path.is_file() and local_path.suffix.lower() == '.zip':
            return _ingest_from_local_zip_path(scan, local_path)
        raise ValueError('Local repository source must be a git directory or a .zip archive.')

    if _looks_like_url(reference):
        return _ingest_from_git_reference(scan, reference)

    raise ValueError(f'Repository source path is not accessible from scanner runtime: {reference}')


def ingest_scan_source(scan: Scan, zip_file=None, repo_files=None, repo_paths=None) -> tuple[str | None, dict]:
    if zip_file is not None:
        return _ingest_from_zip(scan, zip_file)
    if repo_files is not None:
        return _ingest_from_folder_files(scan, repo_files, repo_paths or [])
    return _ingest_from_reference(scan)


def write_bytes_to_workspace(scan_id: int, content: bytes, filename: str = 'snapshot.zip') -> Path:
    workspace_dir, _ = _ensure_workspace(scan_id)
    path = workspace_dir / filename
    path.write_bytes(content)
    return path


def persist_uploaded_zip_for_scan(scan_id: int, uploaded_file) -> Path:
    upload_root = _shared_upload_dir()
    try:
        upload_root.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ValueError(f'Unable to prepare upload workspace: {exc}') from exc
    archive_path = upload_root / f'{scan_id}.zip'

    max_size = int(getattr(settings, 'SCAN_ZIP_MAX_BYTES', 500 * 1024 * 1024))
    total = 0
    try:
        with archive_path.open('wb') as target:
            for chunk in uploaded_file.chunks():
                total += len(chunk)
                if total > max_size:
                    archive_path.unlink(missing_ok=True)
                    raise ValueError(f'Uploaded zip exceeds max size limit ({max_size} bytes).')
                target.write(chunk)
    except OSError as exc:
        archive_path.unlink(missing_ok=True)
        raise ValueError(f'Unable to store uploaded zip: {exc}') from exc

    if not zipfile.is_zipfile(archive_path):
        archive_path.unlink(missing_ok=True)
        raise ValueError('Uploaded file is not a valid .zip archive.')

    # Validate archive constraints before queuing task.
    with tempfile.TemporaryDirectory() as temp_dir:
        _safe_extract_zip(archive_path, Path(temp_dir))
    return archive_path


def ingest_scan_from_zip_path(scan: Scan, zip_path: Path) -> tuple[str | None, dict]:
    _, repo_dir = _ensure_workspace(scan.id)
    _safe_extract_zip(zip_path, repo_dir)
    checksum = _compute_tree_checksum(repo_dir)
    return None, {
        'source': 'zip',
        'snapshot_checksum': checksum,
        'archive_checksum': stable_json_hash({'zip_path': str(zip_path), 'size_bytes': zip_path.stat().st_size}),
        'workspace_dir': str(_workspace_dir(scan.id)),
        'repo_dir': str(repo_dir),
    }


def cleanup_scan_workspace(scan_id: int, retention_seconds: int | None = None) -> None:
    workspace_root = Path(settings.SCAN_WORKDIR)
    workspace_root.mkdir(parents=True, exist_ok=True)

    if retention_seconds is None:
        retention_seconds = int(settings.SCAN_RETENTION_SECONDS)
    current_workspace = _workspace_dir(scan_id)

    if retention_seconds <= 0:
        # Immediate cleanup mode.
        if current_workspace.exists():
            shutil.rmtree(current_workspace, ignore_errors=True)
        for directory in workspace_root.iterdir():
            if directory.is_dir() and directory != current_workspace:
                shutil.rmtree(directory, ignore_errors=True)
        return

    # Determine stale workspaces from scan completion timestamps in DB.
    cutoff = timezone.now() - timedelta(seconds=retention_seconds)
    stale_scan_ids = set(
        Scan.objects.filter(finished_at__isnull=False, finished_at__lt=cutoff).values_list('id', flat=True)
    )

    for directory in workspace_root.iterdir():
        if not directory.is_dir():
            continue
        if directory == current_workspace:
            continue

        directory_scan_id: int | None = None
        try:
            directory_scan_id = int(directory.name)
        except (TypeError, ValueError):
            directory_scan_id = None

        if directory_scan_id is not None:
            if directory_scan_id in stale_scan_ids:
                shutil.rmtree(directory, ignore_errors=True)
            continue

        # Fallback for non-standard folders.
        if directory.stat().st_mtime < time.time() - retention_seconds:
            shutil.rmtree(directory, ignore_errors=True)
