from django.db import migrations

def seed_organizations(apps, schema_editor):
    """Seeds the initial 3 tenant organizations with their respective branding and configurations."""
    Organization = apps.get_model('core', 'Organization')
    
    orgs = [
        {
            "name": "A Maze Venture",
            "slug": "amaze",
            "logo_url": "",
            "primary_color": "#4338ca",  # Indigo-700
            "secondary_color": "#818cf8",  # Indigo-400
            "theme_name": "amaze",
            "policy_config": {
                "allow_negative_sick_leave": True,
                "max_carry_forward_days": 5
            }
        },
        {
            "name": "mYnt Connect",
            "slug": "mynt",
            "logo_url": "",
            "primary_color": "#047857",  # Emerald-700
            "secondary_color": "#34d399",  # Emerald-400
            "theme_name": "mynt",
            "policy_config": {
                "allow_negative_sick_leave": False,
                "max_carry_forward_days": 7
            }
        },
        {
            "name": "Braincount",
            "slug": "braincount",
            "logo_url": "",
            "primary_color": "#b45309",  # Amber-700
            "secondary_color": "#fbbf24",  # Amber-400
            "theme_name": "braincount",
            "policy_config": {
                "allow_negative_sick_leave": True,
                "max_carry_forward_days": 10
            }
        }
    ]
    
    for org_data in orgs:
        # Create or update existing seed records
        Organization.objects.update_or_create(
            slug=org_data["slug"],
            defaults=org_data
        )

def revert_seed(apps, schema_editor):
    """Deletes the seeded organization records on rollback."""
    Organization = apps.get_model('core', 'Organization')
    Organization.objects.filter(slug__in=["amaze", "mynt", "braincount"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_organizations, revert_seed),
    ]
