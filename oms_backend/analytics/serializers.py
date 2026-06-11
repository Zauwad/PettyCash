from rest_framework import serializers
from leave.models import LeaveRequest
from accounts.serializers import UserSerializer

class LeaveAbsenceSerializer(serializers.ModelSerializer):
    """
    Serializer to represent upcoming absences on the analytics dashboard.
    """
    requester_details = UserSerializer(source='requester', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ['id', 'requester_details', 'leave_type_name', 'start_date', 'end_date', 'working_days_requested']
