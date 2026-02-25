from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.findings.models import Finding, FindingSeverity, FindingTool
from apps.projects.models import Project


class ScanApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='scanner',
            email='scanner@example.com',
            password='password123',
        )
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(name='Scan Target', created_by=self.user)

    def test_create_scan_and_filter_findings(self):
        create_scan_response = self.client.post(
            f'/api/projects/{self.project.id}/scans/',
            {
                'commit_hash': 'abc123',
                'meta': {'source': 'test'},
            },
            format='json',
        )
        self.assertEqual(create_scan_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_scan_response.data['status'], 'queued')

        scan_id = create_scan_response.data['id']

        scan_status_response = self.client.get(f'/api/scans/{scan_id}/')
        self.assertEqual(scan_status_response.status_code, status.HTTP_200_OK)
        self.assertEqual(scan_status_response.data['summary']['critical'], 0)

        empty_findings_response = self.client.get(f'/api/scans/{scan_id}/findings/?severity=high')
        self.assertEqual(empty_findings_response.status_code, status.HTTP_200_OK)
        self.assertEqual(empty_findings_response.data['count'], 0)

        finding = Finding.objects.create(
            scan_id=scan_id,
            tool=FindingTool.SEMGREP,
            severity=FindingSeverity.HIGH,
            category='Injection',
            file_path='src/app.py',
            line_start=10,
            line_end=12,
            raw={'rule': 'test-rule'},
            fingerprint='abc-fingerprint',
        )

        filtered_findings_response = self.client.get(f'/api/scans/{scan_id}/findings/?severity=high&file=app.py')
        self.assertEqual(filtered_findings_response.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered_findings_response.data['count'], 1)
        self.assertEqual(filtered_findings_response.data['results'][0]['id'], finding.id)

        finding_detail_response = self.client.get(f'/api/findings/{finding.id}/')
        self.assertEqual(finding_detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(finding_detail_response.data['fingerprint'], 'abc-fingerprint')
