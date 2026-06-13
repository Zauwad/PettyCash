from django.db import migrations

def migrate_approved_to_pending_hr_disbursement(apps, schema_editor):
    PettyCashRequest = apps.get_model('pettycash', 'PettyCashRequest')
    PettyCashRequest.objects.filter(state='approved').update(state='pending_hr_disbursement')

def reverse_approved_migration(apps, schema_editor):
    PettyCashRequest = apps.get_model('pettycash', 'PettyCashRequest')
    PettyCashRequest.objects.filter(state='pending_hr_disbursement').update(state='approved')

class Migration(migrations.Migration):

    dependencies = [
        ('pettycash', '0003_pettycashrequest_ceo_approval_note_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_approved_to_pending_hr_disbursement, reverse_approved_migration),
    ]
