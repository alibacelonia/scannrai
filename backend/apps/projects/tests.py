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
        with tempfile.TemporaryDirectory() as repo_dir:
            porcelain.init(repo_dir)
            response = self.client.post(
                '/api/projects/',
                {
                    'name': 'Local Project',
                    'repo_url': repo_dir,
                },
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['repo_url'], repo_dir)

    def test_project_rejects_duplicate_repository_source(self):
        self.client.post(
            '/api/projects/',
            {'name': 'Demo Project', 'repo_url': 'https://github.com/example/demo'},
            format='json',
        )

        duplicate_response = self.client.post(
            '/api/projects/',
            {'name': 'Demo Project Duplicate', 'repo_url': 'https://github.com/example/demo'},
            format='json',
        )

        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(duplicate_response.data))

    def test_project_rejects_duplicate_repository_source_after_normalization(self):
        self.client.post(
            '/api/projects/',
            {'name': 'Demo Project', 'repo_url': 'https://github.com/example/demo.git/'},
            format='json',
        )

        duplicate_response = self.client.post(
            '/api/projects/',
            {'name': 'Demo Project Duplicate', 'repo_url': 'https://github.com/example/demo'},
            format='json',
        )

        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(duplicate_response.data))

    def test_project_rejects_non_repository_remote_url(self):
        response = self.client.post(
            '/api/projects/',
            {'name': 'Invalid Remote', 'repo_url': 'http://localhost:3000/dashboard'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('repository path segments', str(response.data))

    def test_validate_source_accepts_local_git_repo(self):
        with tempfile.TemporaryDirectory() as repo_dir:
            porcelain.init(repo_dir)
            main_file = Path(repo_dir, 'main.py')
            main_file.write_text('print("ok")\n')
            porcelain.add(repo=repo_dir, paths=[str(main_file)])
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

    def test_validate_source_rejects_remote_url_without_repository_path(self):
        response = self.client.post(
            '/api/projects/validate-source/',
            {'source': 'http://localhost:3000/dashboard'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('repository path segments', response.data['detail'])

    def test_discover_source_returns_matching_git_repo_paths(self):
        with tempfile.TemporaryDirectory() as mount_root:
            repo_dir = Path(mount_root) / 'personal-projects' / 'scannrai'
            repo_dir.mkdir(parents=True, exist_ok=True)
            porcelain.init(str(repo_dir))
            main_file = Path(repo_dir, 'main.py')
            main_file.write_text('print("ok")\n')
            porcelain.add(repo=str(repo_dir), paths=[str(main_file)])
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

    def test_discover_source_finds_repo_outside_preferred_subdirs(self):
        with tempfile.TemporaryDirectory() as mount_root:
            # Keep preferred directory present so discovery does not regress to preferred-only roots.
            (Path(mount_root) / 'personal-projects').mkdir(parents=True, exist_ok=True)

            repo_dir = Path(mount_root) / 'Freelance' / 'IronFort-Compliance' / 'ironforte-prowler'
            repo_dir.mkdir(parents=True, exist_ok=True)
            porcelain.init(str(repo_dir))
            main_file = Path(repo_dir, 'main.py')
            main_file.write_text('print("ok")\n')
            porcelain.add(repo=str(repo_dir), paths=[str(main_file)])
            porcelain.commit(
                repo=str(repo_dir),
                message=b'init',
                author=b'Test <test@example.com>',
                committer=b'Test <test@example.com>',
            )

            with override_settings(LOCAL_REPO_MOUNT_PATH=mount_root):
                response = self.client.post(
                    '/api/projects/discover-source/',
                    {'folder_name': 'ironforte-prowler'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(str(repo_dir), response.data['candidates'])

    def test_discover_source_uses_host_home_when_mount_root_missing(self):
        with tempfile.TemporaryDirectory() as host_home:
            repo_dir = Path(host_home) / 'Freelance' / 'IronFort-Compliance' / 'ironforte-prowler'
            repo_dir.mkdir(parents=True, exist_ok=True)
            porcelain.init(str(repo_dir))
            main_file = Path(repo_dir, 'main.py')
            main_file.write_text('print("ok")\n')
            porcelain.add(repo=str(repo_dir), paths=[str(main_file)])
            porcelain.commit(
                repo=str(repo_dir),
                message=b'init',
                author=b'Test <test@example.com>',
                committer=b'Test <test@example.com>',
            )

            with override_settings(
                LOCAL_REPO_MOUNT_PATH='/path/that/does/not/exist',
                LOCAL_REPO_HOST_HOME=host_home,
            ):
                response = self.client.post(
                    '/api/projects/discover-source/',
                    {'folder_name': 'ironforte-prowler'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(str(repo_dir), response.data['candidates'])

    def test_discover_source_accepts_git_marker_file(self):
        with tempfile.TemporaryDirectory() as mount_root:
            repo_dir = Path(mount_root) / 'Freelance' / 'IronFort-Compliance' / 'ironforte-www'
            repo_dir.mkdir(parents=True, exist_ok=True)
            # Worktree-style repositories can have .git as a file.
            (repo_dir / '.git').write_text('gitdir: /tmp/example\n')
            (repo_dir / 'README.md').write_text('# test\n')

            with override_settings(LOCAL_REPO_MOUNT_PATH=mount_root):
                response = self.client.post(
                    '/api/projects/discover-source/',
                    {'folder_name': 'ironforte-www'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(str(repo_dir), response.data['candidates'])
