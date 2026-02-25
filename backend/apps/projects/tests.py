from django.contrib.auth import get_user_model
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
