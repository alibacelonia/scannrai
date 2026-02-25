from django.contrib.auth import get_user_model
from django.test import override_settings
from pathlib import Path
import tempfile
import zipfile

from dulwich import porcelain
from rest_framework import status
from rest_framework.test import APITestCase


class ProjectApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='tester',
            email='tester@example.com',
            password='password123',
        )
        self.client.force_authenticate(self.user)

    def test_project_crud(self):
        create_response = self.client.post(
            '/api/projects/',
            {
                'name': 'Demo Project',
                'repo_url': 'https://github.com/example/demo',
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        project_id = create_response.data['id']

        list_response = self.client.get('/api/projects/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['count'], 1)

        update_response = self.client.patch(
            f'/api/projects/{project_id}/',
            {'name': 'Renamed Project'},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['name'], 'Renamed Project')

        delete_response = self.client.delete(f'/api/projects/{project_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_project_accepts_local_repository_path(self):
        response = self.client.post(
            '/api/projects/',
            {
                'name': 'Local Project',
                'repo_url': '/host/home/dev/demo-repo',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['repo_url'], '/host/home/dev/demo-repo')

    def test_validate_source_accepts_local_git_repo(self):
        with tempfile.TemporaryDirectory() as repo_dir:
            porcelain.init(repo_dir)
            Path(repo_dir, 'main.py').write_text('print("ok")\n')
            porcelain.add(repo=repo_dir, paths=['main.py'])
            porcelain.commit(
                repo=repo_dir,
                message=b'init',
                author=b'Test <test@example.com>',
                committer=b'Test <test@example.com>',
            )
            response = self.client.post('/api/projects/validate-source/', {'source': repo_dir}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['kind'], 'local_git')

    def test_validate_source_rejects_non_git_folder(self):
        with tempfile.TemporaryDirectory() as source_dir:
            Path(source_dir, 'file.txt').write_text('x')
            response = self.client.post('/api/projects/validate-source/', {'source': source_dir}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing .git', response.data['detail'])

    def test_validate_source_accepts_local_zip(self):
        with tempfile.TemporaryDirectory() as source_dir:
            zip_path = Path(source_dir) / 'repo.zip'
            with zipfile.ZipFile(zip_path, 'w') as archive:
                archive.writestr('a.txt', 'x')
            response = self.client.post('/api/projects/validate-source/', {'source': str(zip_path)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['kind'], 'local_zip')

    def test_discover_source_returns_matching_git_repo_paths(self):
        with tempfile.TemporaryDirectory() as mount_root:
            repo_dir = Path(mount_root) / 'personal-projects' / 'scannrai'
            repo_dir.mkdir(parents=True, exist_ok=True)
            porcelain.init(str(repo_dir))
            Path(repo_dir, 'main.py').write_text('print("ok")\n')
            porcelain.add(repo=str(repo_dir), paths=['main.py'])
            porcelain.commit(
                repo=str(repo_dir),
                message=b'init',
                author=b'Test <test@example.com>',
                committer=b'Test <test@example.com>',
            )

            with override_settings(LOCAL_REPO_MOUNT_PATH=mount_root):
                response = self.client.post('/api/projects/discover-source/', {'folder_name': 'scannrai'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['folder_name'], 'scannrai')
        self.assertIn(str(repo_dir), response.data['candidates'])
