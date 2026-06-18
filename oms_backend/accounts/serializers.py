from rest_framework import serializers
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from core.models import Organization, Department
from accounts.models import UserProfile, UserRole

class OrganizationSummarySerializer(serializers.ModelSerializer):
    """
    Sub-serializer to provide basic organization details on user authentication.
    """
    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'theme_name', 'primary_color', 'secondary_color']


class DepartmentSummarySerializer(serializers.ModelSerializer):
    """
    Sub-serializer to provide basic department details on user authentication.
    """
    budget_committed = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'monthly_budget', 'budget_spent_this_month', 'budget_committed', 'budget_frequency', 'tl_approval_limit']

    def get_budget_committed(self, obj):
        from pettycash.models import PettyCashRequest
        from decimal import Decimal
        
        inflight_requests = PettyCashRequest.objects.filter(
            department=obj,
            state__in=['pending_tl_approval', 'pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed']
        )
        
        total_committed = Decimal('0.00')
        for r in inflight_requests:
            amt = r.amount_approved if r.amount_approved > 0 else r.amount_requested
            total_committed += (Decimal(str(amt)) - Decimal(str(r.amount_disbursed)))
            
        return float(total_committed)


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for the extended user profile.
    """
    organization = OrganizationSummarySerializer(read_only=True)
    department = DepartmentSummarySerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'role', 'role_display', 'employee_id', 'phone', 'avatar_url', 'organization', 'department']


class UserSerializer(serializers.ModelSerializer):
    """
    Comprehensive User Serializer that merges default Django auth User
    attributes with custom tenant-scoped profile details.
    """
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer to allow user-directed updates on profile fields (e.g. phone, avatar).
    """
    class Meta:
        model = UserProfile
        fields = ['phone', 'avatar_url']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends simplejwt TokenObtainPairSerializer to include user profile
    and organization context directly in the login response payload.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        
        user = self.user
        profile = getattr(user, 'profile', None)
        
        user_info = {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
        
        if profile:
            user_info['role'] = profile.role
            user_info['employee_id'] = profile.employee_id
            
            if profile.organization:
                user_info['organization'] = OrganizationSummarySerializer(profile.organization).data
                
            if profile.department:
                user_info['department'] = DepartmentSummarySerializer(profile.department).data
                
        data['user'] = user_info
        return data


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer to handle creation of a User and UserProfile atomically.
    Validates tenant scope, role privileges, and uniqueness.
    """
    role = serializers.ChoiceField(choices=UserRole.choices, required=True, write_only=True)
    employee_id = serializers.CharField(max_length=20, required=True, write_only=True)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True, default='', write_only=True)
    avatar_url = serializers.CharField(required=False, allow_blank=True, default='', write_only=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True, write_only=True)
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'role', 'employee_id', 'phone', 'department', 'avatar_url']

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return value

    def validate_department(self, value):
        request = self.context.get('request')
        if request and value:
            creator_profile = getattr(request.user, 'profile', None)
            if creator_profile and value.organization != creator_profile.organization:
                raise serializers.ValidationError("Department must belong to your organization.")
        return value

    def validate_employee_id(self, value):
        if UserProfile.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("A profile with this Employee ID already exists.")
        return value

    def validate_role(self, value):
        request = self.context.get('request')
        if request:
            creator_profile = getattr(request.user, 'profile', None)
            if creator_profile and creator_profile.role != UserRole.ADMIN:
                if value == UserRole.ADMIN:
                    raise serializers.ValidationError("Only Global Admins can assign the Global Admin role.")
                if value == UserRole.CEO:
                    raise serializers.ValidationError("Only Global Admins can assign the CEO role.")
        return value

    def create(self, validated_data):
        role = validated_data.pop('role')
        employee_id = validated_data.pop('employee_id')
        phone = validated_data.pop('phone', '')
        avatar_url = validated_data.pop('avatar_url', '')
        department = validated_data.pop('department', None)
        password = validated_data.pop('password')
        organization = validated_data.pop('organization', None)
        
        request = self.context.get('request')
        if not organization:
            creator_profile = getattr(request.user, 'profile', None)
            if creator_profile:
                organization = creator_profile.organization

        # Create user
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()

        # Create profile
        UserProfile.objects.create(
            user=user,
            organization=organization,
            department=department,
            role=role,
            employee_id=employee_id,
            phone=phone,
            avatar_url=avatar_url
        )

        return user

