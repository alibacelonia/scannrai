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
