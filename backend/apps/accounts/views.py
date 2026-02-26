from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile
from .serializers import ChangePasswordSerializer, MeSerializer, RegisterSerializer, UserProfileUpdateSerializer


class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(MeSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _get_profile(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return profile

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        profile = self._get_profile(request)
        serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)

    def put(self, request):
        profile = self._get_profile(request)
        serializer = UserProfileUpdateSerializer(profile, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)
