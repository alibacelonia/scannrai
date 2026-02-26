from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


class AccountsApiTests(APITestCase):
    def test_register_and_me(self):
        register_response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        token_response = self.client.post(
            '/api/auth/token/',
            {
                'username': 'newuser',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        access = token_response.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        me_response = self.client.get('/api/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data['username'], 'newuser')
        self.assertIn('profile', me_response.data)
        self.assertFalse(me_response.data['has_completed_profile'])

    def test_profile_update_marks_user_profile_completed(self):
        register_response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'profileuser',
                'email': 'profileuser@example.com',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        token_response = self.client.post(
            '/api/auth/token/',
            {
                'username': 'profileuser',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        access = token_response.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        update_response = self.client.patch(
            '/api/me/',
            {
                'full_name': 'Profile User',
                'job_title': 'Security Engineer',
                'bio': 'Builds secure scanning workflows.',
            },
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertTrue(update_response.data['has_completed_profile'])
        self.assertEqual(update_response.data['profile']['full_name'], 'Profile User')
        self.assertEqual(update_response.data['profile']['job_title'], 'Security Engineer')

    def test_change_password(self):
        register_response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'passworduser',
                'email': 'passworduser@example.com',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        token_response = self.client.post(
            '/api/auth/token/',
            {
                'username': 'passworduser',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        access = token_response.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        change_response = self.client.post(
            '/api/auth/change-password/',
            {
                'current_password': 'StrongPassword123!',
                'new_password': 'NewStrongPassword456!',
            },
            format='json',
        )
        self.assertEqual(change_response.status_code, status.HTTP_200_OK)

        old_login_response = self.client.post(
            '/api/auth/token/',
            {
                'username': 'passworduser',
                'password': 'StrongPassword123!'
            },
            format='json',
        )
        self.assertEqual(old_login_response.status_code, status.HTTP_401_UNAUTHORIZED)

        new_login_response = self.client.post(
            '/api/auth/token/',
            {
                'username': 'passworduser',
                'password': 'NewStrongPassword456!'
            },
            format='json',
        )
        self.assertEqual(new_login_response.status_code, status.HTTP_200_OK)

    @override_settings(CORS_ALLOWED_ORIGINS=['http://localhost:3000'])
    def test_register_preflight_returns_cors_headers(self):
        response = self.client.options(
            '/api/auth/register/',
            HTTP_ORIGIN='http://localhost:3000',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Access-Control-Allow-Origin'], 'http://localhost:3000')
