import json
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project
from apps.scans.models import Scan, ScanStatus

from .models import Finding, FindingSeverity, FindingTool
from .normalizers import normalize_and_store_findings


class FindingNormalizationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='normalizer',
            email='normalizer@example.com',
            password='password123',
        )
        self.project = Project.objects.create(name='Normalize Project', created_by=self.user)
        self.scan = Scan.objects.create(project=self.project, status=ScanStatus.COMPLETED)

    def test_normalize_outputs_with_dedupe_and_masking(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            semgrep_path = temp_path / 'semgrep.json'
            osv_path = temp_path / 'osv-scanner.json'
            gitleaks_path = temp_path / 'gitleaks.json'

            semgrep_path.write_text(
                json.dumps(
                    {
                        'results': [
                            {
                                'check_id': 'python.sql.injection',
                                'path': 'app/views.py',
                                'start': {'line': 10},
                                'end': {'line': 10},
                                'extra': {'severity': 'WARNING', 'message': 'Possible SQL injection'},
                            },
                            {
                                'check_id': 'python.sql.injection',
                                'path': 'app/views.py',
                                'start': {'line': 10},
                                'end': {'line': 10},
                                'extra': {'severity': 'WARNING', 'message': 'Possible SQL injection'},
                            },
                        ]
                    }
                ),
                encoding='utf-8',
            )

            osv_path.write_text(
                json.dumps(
                    {
                        'results': [
                            {
                                'packages': [
                                    {
                                        'package': {'name': 'django'},
                                        'version': '5.1.6',
                                        'path': 'requirements.txt',
                                    }
                                ],
                                'vulns': [
                                    {
                                        'id': 'GHSA-xxxx-yyyy-zzzz',
                                        'severity': [{'type': 'CVSS_V3', 'score': '8.1'}],
                                    }
                                ],
                            }
                        ]
                    }
                ),
                encoding='utf-8',
            )

            gitleaks_path.write_text(
                json.dumps(
                    [
                        {
                            'RuleID': 'generic-api-key',
                            'File': '.env',
                            'StartLine': 2,
                            'EndLine': 2,
                            'Secret': 'very-secret-value',
                            'Match': 'very-secret-value',
                        }
                    ]
                ),
                encoding='utf-8',
            )

            result = normalize_and_store_findings(
                self.scan,
                {
                    'semgrep': str(semgrep_path),
                    'osv': str(osv_path),
                    'gitleaks': str(gitleaks_path),
                },
            )

        self.assertEqual(Finding.objects.filter(scan=self.scan).count(), 3)
        self.assertEqual(result['normalized_total'], 4)
        self.assertEqual(result['deduped_total'], 3)

        self.assertEqual(
            Finding.objects.filter(scan=self.scan, tool=FindingTool.SEMGREP, severity=FindingSeverity.MEDIUM).count(),
            1,
        )
        self.assertEqual(
            Finding.objects.filter(scan=self.scan, tool=FindingTool.OSV, severity=FindingSeverity.HIGH).count(),
            1,
        )
        self.assertEqual(
            Finding.objects.filter(scan=self.scan, tool=FindingTool.GITLEAKS, severity=FindingSeverity.HIGH).count(),
            1,
        )

        gitleaks_finding = Finding.objects.get(scan=self.scan, tool=FindingTool.GITLEAKS)
        self.assertEqual(gitleaks_finding.raw['Secret'], '***REDACTED***')
        self.assertEqual(gitleaks_finding.raw['Match'], '***REDACTED***')


class FindingAiEndpointsTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='aiuser',
            email='aiuser@example.com',
            password='password123',
        )
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(name='AI Project', created_by=self.user)
        self.scan = Scan.objects.create(project=self.project, status=ScanStatus.COMPLETED)
        self.finding = Finding.objects.create(
            scan=self.scan,
            tool=FindingTool.SEMGREP,
            severity=FindingSeverity.HIGH,
            category='Injection',
            file_path='src/app.py',
            line_start=4,
            line_end=4,
            raw={'detail': 'Potential issue'},
            fingerprint='ai-test-fingerprint',
        )

    def test_ai_explain_and_patch(self):
        explain_response = self.client.post(f'/api/findings/{self.finding.id}/ai/explain/')
        self.assertEqual(explain_response.status_code, status.HTTP_200_OK)
        self.assertIn('ai_explanation', explain_response.data)
        self.assertIn('confidence', explain_response.data)

        patch_response = self.client.post(f'/api/findings/{self.finding.id}/ai/patch/')
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertIn('ai_patch_diff', patch_response.data)
