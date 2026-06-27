from rest_framework import serializers
from django.contrib.auth.models import User
from leave.models import LeaveRequest
from core.models import Department
from accounts.models import UserProfile

class LightweightDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']

class LightweightProfileSerializer(serializers.ModelSerializer):
    department = LightweightDepartmentSerializer(read_only=True)
    class Meta:
        model = UserProfile
        fields = ['id', 'department']

class LightweightUserSerializer(serializers.ModelSerializer):
    profile = LightweightProfileSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'profile']

class LeaveAbsenceSerializer(serializers.ModelSerializer):
    """
    Serializer to represent upcoming absences on the analytics dashboard.
    """
    requester_details = LightweightUserSerializer(source='requester', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ['id', 'requester_details', 'leave_type_name', 'start_date', 'end_date', 'working_days_requested']
