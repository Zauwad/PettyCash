from rest_framework import serializers
from django.contrib.auth.models import User
from core.models import Organization, Department
from accounts.serializers import UserSerializer, DepartmentSummarySerializer
from pettycash.models import PettyCashRequest, PettyCashLineItem, Attachment, Disbursement

class AttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for uploading and listing attachments.
    Saves file content directly into the SQL database binary field.
    """
    file = serializers.FileField(write_only=True, required=False)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ['id', 'original_filename', 'content_type', 'file_size_bytes', 'uploaded_at', 'file', 'download_url']
        read_only_fields = ['original_filename', 'content_type', 'file_size_bytes', 'uploaded_at', 'download_url']

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = f"/api/attachments/{obj.id}/download/"
        if request:
            return request.build_absolute_uri(path)
        return path

    def validate_file(self, value):
        # Validate maximum size of 10MB
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File size cannot exceed 10MB.")
            
        allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(f"File type {value.content_type} is not allowed.")
            
        return value

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        if not file_obj:
            raise serializers.ValidationError({"file": "No file uploaded."})
            
        # Extract files data directly to save in BLOB
        validated_data['file_data'] = file_obj.read()
        validated_data['original_filename'] = file_obj.name
        validated_data['content_type'] = file_obj.content_type
        validated_data['file_size_bytes'] = file_obj.size
        
        return super().create(validated_data)


class PettyCashLineItemSerializer(serializers.ModelSerializer):
    """
    Serializer for request line items. Writable from parent request.
    """
    class Meta:
        model = PettyCashLineItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total_price', 'category']
        read_only_fields = ['total_price']


class DisbursementSerializer(serializers.ModelSerializer):
    """
    Serializer for disbursements.
    """
    disbursed_by_name = serializers.CharField(source='disbursed_by.get_full_name', read_only=True)

    class Meta:
        model = Disbursement
        fields = ['id', 'amount', 'payment_method', 'reference_number', 'notes', 'disbursed_at', 'disbursed_by_name']
        read_only_fields = ['disbursed_by_name']


class PettyCashRequestSerializer(serializers.ModelSerializer):
    """
    Comprehensive serializer for PettyCashRequest.
    Handles nested line items for creation and updates.
    """
    line_items = PettyCashLineItemSerializer(many=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    disbursements = DisbursementSerializer(many=True, read_only=True)
    requester_name = serializers.CharField(source='requester.get_full_name', read_only=True)
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    department_details = DepartmentSummarySerializer(source='department', read_only=True)
    
    # Write-only field to specify department on creation
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source='department',
        write_only=True
    )

    activity_log = serializers.SerializerMethodField()

    class Meta:
        model = PettyCashRequest
        fields = [
            'id', 'uuid', 'title', 'description', 'amount_requested', 'amount_approved', 
            'amount_disbursed', 'state', 'priority', 'needed_by', 'rejection_reason', 
            'tl_approval_note', 'ceo_approval_note', 'hr_disbursement_note',
            'tl_approved_amount', 'tl_approved_needed_by',
            'ceo_approved_amount', 'ceo_approved_needed_by',
            'created_at', 'updated_at', 'requester_name', 'requester_email', 
            'department_details', 'department_id', 'line_items', 'attachments', 'disbursements',
            'activity_log'
        ]
        read_only_fields = [
            'uuid', 'amount_approved', 'amount_disbursed', 'state', 'rejection_reason', 
            'tl_approval_note', 'ceo_approval_note', 'hr_disbursement_note',
            'tl_approved_amount', 'tl_approved_needed_by',
            'ceo_approved_amount', 'ceo_approved_needed_by',
            'created_at', 'updated_at', 'activity_log'
        ]

    def get_activity_log(self, obj):
        # Skip fetching activity logs on list action to avoid N+1 queries
        view = self.context.get('view')
        if view and getattr(view, 'action', None) == 'list':
            return []

        from core.models import AuditLog
        from core.serializers import AuditLogSerializer
        logs = AuditLog.objects.filter(target_type='PettyCashRequest', target_id=obj.id).order_by('created_at')
        return AuditLogSerializer(logs, many=True).data

    def create(self, validated_data):
        line_items_data = validated_data.pop('line_items', [])
        
        # requester is injected by the ViewSet perform_create
        request = PettyCashRequest.objects.create(**validated_data)
        
        # Create nested line items
        for item_data in line_items_data:
            PettyCashLineItem.objects.create(request=request, **item_data)
            
        return request

    def update(self, instance, validated_data):
        from accounts.models import UserRole
        request = self.context.get('request')
        user = request.user if request else None
        role = user.profile.role if (user and hasattr(user, 'profile')) else None
        
        is_override_user = role in [UserRole.ADMIN, UserRole.CEO, UserRole.HR]
        
        # Nested line items can only be updated if in 'draft' or 'rejected_by_ceo' state (unless CEO/HR override)
        if not is_override_user and instance.state not in ['draft', 'rejected_by_ceo']:
            raise serializers.ValidationError("Only requests in draft or rejected by CEO state can be modified.")
            
        line_items_data = validated_data.pop('line_items', None)
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update line items if provided
        if line_items_data is not None:
            # Delete existing line items and recreate them
            instance.line_items.all().delete()
            for item_data in line_items_data:
                PettyCashLineItem.objects.create(request=instance, **item_data)
                
        return instance
