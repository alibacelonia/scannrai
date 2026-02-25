import subprocess
import tempfile
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from dulwich import porcelain
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.findings.models import Finding, FindingSeverity, FindingTool
from apps.projects.models import Project
from apps.scans.models import AuditEventType, AuditLog
from apps.scans.tasks import scan_repo
from apps.scans.tool_runners import run_osv_scanner


class ScanApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='scanner',
            email='scanner@example.com',
            password='password123',
        )
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(name='Scan Target', created_by=self.user)

    def _init_git_repo(self, repo_dir: str) -> str:
        porcelain.init(repo_dir)
        Path(repo_dir, 'main.py').write_text('print("scan")\n')
        porcelain.add(repo=repo_dir, paths=['main.py'])
        return porcelain.commit(
            repo=repo_dir,
            message=b'Initial commit',
            author=b'Test <test@example.com>',
            committer=b'Test <test@example.com>',
        ).decode('utf-8')

    def test_queue_scan_then_worker_completes_and_endpoints_work(self):
        with tempfile.TemporaryDirectory() as source_repo_dir, tempfile.TemporaryDirectory() as workspace:
            self._init_git_repo(source_repo_dir)
            self.project.repo_url = source_repo_dir
            self.project.save(update_fields=['repo_url'])

            with override_settings(SCAN_WORKDIR=workspace, SCAN_RETENTION_SECONDS=3600):
                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-1')):
                    create_scan_response = self.client.post(
                        f'/api/projects/{self.project.id}/scans/',
                        {'meta': {'source_hint': 'git'}},
                        format='json',
                    )

                self.assertEqual(create_scan_response.status_code, status.HTTP_201_CREATED)
                self.assertEqual(create_scan_response.data['status'], 'queued')
                self.assertEqual(create_scan_response.data['meta']['queued_via'], 'celery')
                scan_id = create_scan_response.data['id']

                scan_repo(scan_id)

                scan_status_response = self.client.get(f'/api/scans/{scan_id}/')
                self.assertEqual(scan_status_response.status_code, status.HTTP_200_OK)
                self.assertEqual(scan_status_response.data['status'], 'completed')
                self.assertIn('tool_runs', scan_status_response.data['meta'])
                self.assertIn('tool_output_paths', scan_status_response.data['meta'])
                self.assertEqual(scan_status_response.data['summary']['critical'], 0)

                workspace_path = Path(scan_status_response.data['meta']['workspace_dir'])
                self.assertTrue(workspace_path.exists())
                for output_path in scan_status_response.data['meta']['tool_output_paths'].values():
                    self.assertTrue(Path(output_path).exists())

                audit_events = list(AuditLog.objects.filter(scan_id=scan_id).values_list('event_type', flat=True))
                self.assertIn(AuditEventType.SCAN_STARTED, audit_events)
                self.assertIn(AuditEventType.SCAN_COMPLETED, audit_events)

                project_scans_response = self.client.get(f'/api/projects/{self.project.id}/scans/')
                self.assertEqual(project_scans_response.status_code, status.HTTP_200_OK)
                self.assertEqual(project_scans_response.data['count'], 1)

                empty_findings_response = self.client.get(f'/api/scans/{scan_id}/findings/?severity=high')
                self.assertEqual(empty_findings_response.status_code, status.HTTP_200_OK)
                self.assertEqual(empty_findings_response.data['count'], 0)

                finding = Finding.objects.create(
                    scan_id=scan_id,
                    tool=FindingTool.SEMGREP,
                    severity=FindingSeverity.HIGH,
                    category='Injection',
                    file_path='main.py',
                    line_start=1,
                    line_end=1,
                    raw={'rule': 'test-rule'},
                    fingerprint='abc-fingerprint',
                )

                filtered_findings_response = self.client.get(f'/api/scans/{scan_id}/findings/?severity=high&file=main.py')
                self.assertEqual(filtered_findings_response.status_code, status.HTTP_200_OK)
                self.assertEqual(filtered_findings_response.data['count'], 1)
                self.assertEqual(filtered_findings_response.data['results'][0]['id'], finding.id)

                category_response = self.client.get(f'/api/scans/{scan_id}/findings/?category=ject')
                self.assertEqual(category_response.status_code, status.HTTP_200_OK)
                self.assertEqual(category_response.data['count'], 1)

                finding_detail_response = self.client.get(f'/api/findings/{finding.id}/')
                self.assertEqual(finding_detail_response.status_code, status.HTTP_200_OK)
                self.assertEqual(finding_detail_response.data['fingerprint'], 'abc-fingerprint')
                self.assertIn('snippet', finding_detail_response.data)
                self.assertEqual(finding_detail_response.data['snippet']['lines'][0]['line_number'], 1)

                ai_summary_response = self.client.post(f'/api/scans/{scan_id}/ai/summary/')
                self.assertEqual(ai_summary_response.status_code, status.HTTP_200_OK)
                self.assertIn('ai_summary', ai_summary_response.data)

                export_json_response = self.client.get(f'/api/scans/{scan_id}/export.json/')
                self.assertEqual(export_json_response.status_code, status.HTTP_200_OK)
                self.assertIn('findings', export_json_response.data)

                export_md_response = self.client.get(f'/api/scans/{scan_id}/export.md/')
                self.assertEqual(export_md_response.status_code, status.HTTP_200_OK)
                self.assertIn('# ScannrAI Report', export_md_response.content.decode('utf-8'))

    def test_create_scan_from_local_zip_path(self):
        with tempfile.TemporaryDirectory() as source_dir, tempfile.TemporaryDirectory() as workspace:
            zip_path = Path(source_dir) / 'snapshot.zip'
            with zipfile.ZipFile(zip_path, 'w') as archive:
                archive.writestr('src/app.py', 'print("hello")\n')

            self.project.repo_url = str(zip_path)
            self.project.save(update_fields=['repo_url'])

            with override_settings(SCAN_WORKDIR=workspace, SCAN_RETENTION_SECONDS=3600):
                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-zip')):
                    response = self.client.post(
                        f'/api/projects/{self.project.id}/scans/',
                        {'meta': {'source_hint': 'local-zip'}},
                        format='json',
                    )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertEqual(response.data['status'], 'queued')
                scan_id = response.data['id']

                scan_repo(scan_id)
                refreshed = self.client.get(f'/api/scans/{scan_id}/')
                self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
                self.assertEqual(refreshed.data['status'], 'completed')
                self.assertEqual(refreshed.data['meta']['source'], 'local_zip')
                self.assertEqual(refreshed.data['meta']['local_path'], str(zip_path))

    def test_local_git_repo_with_dangling_symlink_completes_scan(self):
        with tempfile.TemporaryDirectory() as source_repo_dir, tempfile.TemporaryDirectory() as workspace:
            self._init_git_repo(source_repo_dir)
            dangling_link = Path(source_repo_dir) / 'mobile' / 'ios' / '.symlinks' / 'plugins' / 'integration_test'
            dangling_link.parent.mkdir(parents=True, exist_ok=True)

            try:
                dangling_link.symlink_to('/definitely/missing/target')
            except (NotImplementedError, OSError):
                self.skipTest('Symlink creation not supported in this test environment.')

            self.project.repo_url = source_repo_dir
            self.project.save(update_fields=['repo_url'])

            with override_settings(SCAN_WORKDIR=workspace, SCAN_RETENTION_SECONDS=3600):
                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-dangling')):
                    response = self.client.post(
                        f'/api/projects/{self.project.id}/scans/',
                        {'meta': {'source_hint': 'local-git'}},
                        format='json',
                    )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                scan_id = response.data['id']

                scan_repo(scan_id)

                refreshed = self.client.get(f'/api/scans/{scan_id}/')
                self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
                self.assertEqual(refreshed.data['status'], 'completed')
                self.assertEqual(refreshed.data['meta']['source'], 'local_git')
                self.assertNotIn('ingestion_error', refreshed.data['meta'])

    def test_upload_payload_rejected(self):
        upload = SimpleUploadedFile('repo.zip', b'PK\x03\x04', content_type='application/zip')
        response = self.client.post(
            f'/api/projects/{self.project.id}/scans/',
            {'zip_file': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('disabled', response.data['detail'])

    def test_missing_repo_source_returns_400(self):
        response = self.client.post(
            f'/api/projects/{self.project.id}/scans/',
            {'meta': {'trigger': 'no-source'}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Repository source is required', response.data['detail'])

    def test_local_folder_without_git_metadata_returns_400(self):
        with tempfile.TemporaryDirectory() as source_dir:
            Path(source_dir, 'main.py').write_text('print("not-git")\n')
            self.project.repo_url = source_dir
            self.project.save(update_fields=['repo_url'])

            response = self.client.post(
                f'/api/projects/{self.project.id}/scans/',
                {'meta': {'source_hint': 'local-folder'}},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing .git', response.data['detail'])

    def test_local_zip_path_with_invalid_archive_returns_400(self):
        with tempfile.TemporaryDirectory() as source_dir:
            bad_zip = Path(source_dir) / 'broken.zip'
            bad_zip.write_text('not-a-zip')
            self.project.repo_url = str(bad_zip)
            self.project.save(update_fields=['repo_url'])

            response = self.client.post(
                f'/api/projects/{self.project.id}/scans/',
                {'meta': {'source_hint': 'local-zip'}},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not a valid .zip archive', response.data['detail'])

    def test_create_scan_from_git_repo_url_records_commit_hash(self):
        with tempfile.TemporaryDirectory() as source_repo_dir, tempfile.TemporaryDirectory() as workspace:
            porcelain.init(source_repo_dir)
            Path(source_repo_dir, 'main.py').write_text('print(\"scan\")\\n')
            porcelain.add(repo=source_repo_dir, paths=['main.py'])
            commit_id = porcelain.commit(
                repo=source_repo_dir,
                message=b'Initial commit',
                author=b'Test <test@example.com>',
                committer=b'Test <test@example.com>',
            ).decode('utf-8')

            project = Project.objects.create(
                name='Git Source Project',
                created_by=self.user,
                repo_url=source_repo_dir,
            )

            with override_settings(SCAN_WORKDIR=workspace, SCAN_RETENTION_SECONDS=3600):
                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-git')):
                    response = self.client.post(
                        f'/api/projects/{project.id}/scans/',
                        {'meta': {'source_hint': 'git'}},
                        format='json',
                    )

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(response.data['status'], 'queued')
            scan_repo(response.data['id'])
            refreshed = self.client.get(f'/api/scans/{response.data["id"]}/')
            self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
            self.assertEqual(refreshed.data['status'], 'completed')
            self.assertEqual(refreshed.data['commit_hash'], commit_id)
            self.assertEqual(refreshed.data['meta']['source'], 'local_git')

    def test_invalid_repo_url_returns_failed_scan_with_error(self):
        with tempfile.TemporaryDirectory() as workspace:
            invalid_project = Project.objects.create(
                name='Invalid Repo',
                created_by=self.user,
                repo_url='file:///definitely-not-a-real-repo-path',
            )

            with override_settings(SCAN_WORKDIR=workspace, SCAN_RETENTION_SECONDS=3600):
                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-invalid')):
                    response = self.client.post(
                        f'/api/projects/{invalid_project.id}/scans/',
                        {'meta': {'source_hint': 'invalid-repo'}},
                        format='json',
                    )

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(response.data['status'], 'queued')
            scan_repo(response.data['id'])
            refreshed = self.client.get(f'/api/scans/{response.data["id"]}/')
            self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
            self.assertEqual(refreshed.data['status'], 'failed')
            self.assertIn('ingestion_error', refreshed.data['meta'])

    def test_scan_rate_limit_returns_429(self):
        with tempfile.TemporaryDirectory() as source_repo_dir, tempfile.TemporaryDirectory() as workspace:
            self._init_git_repo(source_repo_dir)
            self.project.repo_url = source_repo_dir
            self.project.save(update_fields=['repo_url'])
            with override_settings(SCAN_WORKDIR=workspace, SCAN_RETENTION_SECONDS=3600, SCAN_RATE_LIMIT_PER_HOUR=1):
                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-rate-1')):
                    first_response = self.client.post(
                        f'/api/projects/{self.project.id}/scans/',
                        {'meta': {'source_hint': 'git'}},
                        format='json',
                    )
                self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

                with patch('apps.projects.views.scan_repo.delay', return_value=SimpleNamespace(id='task-rate-2')):
                    second_response = self.client.post(
                        f'/api/projects/{self.project.id}/scans/',
                        {'meta': {'source_hint': 'git'}},
                        format='json',
                    )
                self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class ToolRunnerTests(SimpleTestCase):
    def test_osv_runner_timeout_writes_error_payload(self):
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as out_dir:
            repo_path = Path(repo_dir)
            output_path = Path(out_dir)
            repo_path.joinpath('sample.txt').write_text('sample')

            with patch(
                'apps.scans.tool_runners.subprocess.run',
                side_effect=subprocess.TimeoutExpired(cmd='osv-scanner', timeout=1),
            ):
                result = run_osv_scanner(repo_path, output_path, timeout_seconds=1)

            self.assertTrue(result['timed_out'])
            self.assertTrue(Path(result['output_path']).exists())
