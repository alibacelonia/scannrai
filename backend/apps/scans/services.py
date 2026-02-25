import hashlib
import shutil
import subprocess
import time
import zipfile
from pathlib import Path

from django.conf import settings

from dulwich import porcelain
from dulwich.repo import Repo

from .models import Scan


def _workspace_dir(scan_id: int) -> Path:
    return Path(settings.SCAN_WORKDIR) / str(scan_id)


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
        for member in archive.infolist():
            extracted_path = (destination / member.filename).resolve()
            if extracted_path != destination_root and destination_root not in extracted_path.parents:
                raise ValueError('Zip archive contains invalid paths.')
        archive.extractall(destination)


def _compute_tree_checksum(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if path.is_file():
            digest.update(str(path.relative_to(root)).encode('utf-8'))
            with path.open('rb') as file_obj:
                while True:
                    chunk = file_obj.read(8192)
                    if not chunk:
                        break
                    digest.update(chunk)
    return digest.hexdigest()


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


def _ingest_from_git(scan: Scan) -> tuple[str | None, dict]:
    if not scan.project.repo_url:
        raise ValueError('No repository source provided. Set a project repo URL or upload a ZIP file.')

    workspace_dir, repo_dir = _ensure_workspace(scan.id)
    clone_mode = 'shallow'

    clone_result = subprocess.run(
        ['git', 'clone', '--depth', '1', scan.project.repo_url, str(repo_dir)],
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
        porcelain.clone(scan.project.repo_url, str(repo_dir), checkout=True)
        repo = Repo(str(repo_dir))
        commit_hash = repo.head().decode('utf-8')

    meta = {
        'source': 'git',
        'repo_url': scan.project.repo_url,
        'clone_mode': clone_mode,
        'workspace_dir': str(workspace_dir),
        'repo_dir': str(repo_dir),
    }
    return commit_hash, meta


def ingest_scan_source(scan: Scan, zip_file=None) -> tuple[str | None, dict]:
    if zip_file is not None:
        return _ingest_from_zip(scan, zip_file)
    return _ingest_from_git(scan)


def write_bytes_to_workspace(scan_id: int, content: bytes, filename: str = 'snapshot.zip') -> Path:
    workspace_dir, _ = _ensure_workspace(scan_id)
    path = workspace_dir / filename
    path.write_bytes(content)
    return path


def ingest_scan_from_zip_path(scan: Scan, zip_path: Path) -> tuple[str | None, dict]:
    _, repo_dir = _ensure_workspace(scan.id)
    _safe_extract_zip(zip_path, repo_dir)
    checksum = _compute_tree_checksum(repo_dir)
    return None, {
        'source': 'zip',
        'snapshot_checksum': checksum,
        'workspace_dir': str(_workspace_dir(scan.id)),
        'repo_dir': str(repo_dir),
    }


def cleanup_scan_workspace(scan_id: int) -> None:
    workspace_root = Path(settings.SCAN_WORKDIR)
    workspace_root.mkdir(parents=True, exist_ok=True)

    retention_seconds = int(settings.SCAN_RETENTION_SECONDS)
    current_workspace = _workspace_dir(scan_id)

    if retention_seconds <= 0 and current_workspace.exists():
        shutil.rmtree(current_workspace, ignore_errors=True)

    cutoff = time.time() - retention_seconds
    for directory in workspace_root.iterdir():
        if not directory.is_dir():
            continue
        if directory.stat().st_mtime < cutoff:
            shutil.rmtree(directory, ignore_errors=True)
