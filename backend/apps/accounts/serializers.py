from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'email', 'password')
        read_only_fields = ('id',)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        UserProfile.objects.get_or_create(user=user)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("full_name", "job_title", "bio", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("full_name", "job_title", "bio")


class MeSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()
    has_completed_profile = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'email', 'profile', 'has_completed_profile')

    def _ensure_profile(self, user):
        profile = getattr(user, "_cached_profile", None)
        if profile is not None:
            return profile
        profile, _ = UserProfile.objects.get_or_create(user=user)
        setattr(user, "_cached_profile", profile)
        return profile

    def get_profile(self, obj):
        profile = self._ensure_profile(obj)
        return UserProfileSerializer(profile).data

    def get_has_completed_profile(self, obj):
        profile = self._ensure_profile(obj)
        return profile.is_completed


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["user"]
        current_password = attrs.get("current_password", "")
        new_password = attrs.get("new_password", "")

        if not user.check_password(current_password):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        if current_password == new_password:
            raise serializers.ValidationError({"new_password": "New password must be different from current password."})

        validate_password(new_password, user=user)
        return attrs
