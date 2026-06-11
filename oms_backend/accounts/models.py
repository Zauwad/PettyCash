from django.db import models
from django.contrib.auth.models import User
from core.models import Organization, Department

# Create your models here.

class UserRole(models.TextChoices):
    """
    Available roles inside the OMS system.
    Determines permission clearance level and approval authority routing.
    """
    EMPLOYEE = "EMPLOYEE", "Employee"
    TEAM_LEAD = "TEAM_LEAD", "Team Lead"
    CEO = "CEO", "CEO"
    ADMIN = "ADMIN", "Global Admin"


class UserProfile(models.Model):
    """
    Extends the Django default User model with tenancy (organization, department),
    role permissions, and other system-related user details.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
        help_text="One-to-One connection to Django Auth User"
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="profiles",
        help_text="The tenant organization this user is isolation-scoped to"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="profiles",
        help_text="The department this user belongs to"
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
        help_text="User system clearance role"
    )
    employee_id = models.CharField(
        max_length=20,
        unique=True,
        help_text="Unique employee identification string"
    )
    phone = models.CharField(
        max_length=15,
        blank=True,
        null=True
    )
    avatar_url = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Public S3 / Cloud / Gravatar avatar path"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.role}) - {self.organization.name}"
