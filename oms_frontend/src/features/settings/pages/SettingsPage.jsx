import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { authApi } from '@/features/auth/api/authApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { 
  User, 
  Phone, 
  Image, 
  Building, 
  ShieldCheck, 
  Key,
  Info,
  Save
} from 'lucide-react';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';

const profileSchema = z.object({
  phone: z.string().min(6, 'Phone number must be at least 6 characters').max(15, 'Phone number too long'),
  avatar_url: z.string().url('Must be a valid URL').or(z.string().length(0)),
});

export function SettingsPage() {
  const { user } = useAuth();
  const updateProfileStore = useAuthStore((s) => s.updateProfile);

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: user?.profile?.phone || '',
      avatar_url: user?.profile?.avatar_url || '',
    }
  });

  // Mutation: Update profile
  const updateProfileMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (res) => {
      // Update global store
      updateProfileStore({
        phone: res.profile?.phone,
        avatar_url: res.profile?.avatar_url,
      });
      toast.success('Profile settings updated successfully!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to save changes.');
    }
  });

  const listRef = useGSAPStagger('.settings-card', []);

  const onSubmit = (data) => {
    updateProfileMutation.mutate(data);
  };

  const roleDisplay = user?.profile?.role_display || user?.profile?.role;

  return (
    <PageTransition>
      <div ref={listRef} className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-base-content/5 pb-5">
          <h2 className="text-3xl font-extrabold Outfit tracking-tight">Portal Settings</h2>
          <p className="text-sm text-base-content/55">Manage your personal profiles, contact channels, and system preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Edit Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="settings-card glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5">
              <h3 className="text-lg font-bold Outfit border-b border-base-content/5 pb-3">Edit Contact Profile</h3>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                      <input
                        type="text"
                        className={`input input-bordered pl-11 rounded-xl w-full bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm h-11 ${
                          errors.phone ? 'input-error' : ''
                        }`}
                        placeholder="+88017XXXXXXXX"
                        {...register('phone')}
                      />
                    </div>
                    {errors.phone && (
                      <span className="text-xs text-error font-medium mt-1 block">{errors.phone.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="label text-[10px] font-bold text-base-content/75 uppercase tracking-wider">Avatar Image URL</label>
                    <div className="relative">
                      <Image className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                      <input
                        type="text"
                        className={`input input-bordered pl-11 rounded-xl w-full bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm h-11 ${
                          errors.avatar_url ? 'input-error' : ''
                        }`}
                        placeholder="https://example.com/avatar.jpg"
                        {...register('avatar_url')}
                      />
                    </div>
                    {errors.avatar_url && (
                      <span className="text-xs text-error font-medium mt-1 block">{errors.avatar_url.message}</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="btn btn-primary rounded-xl font-bold px-8 gap-2 shadow-lg shadow-primary/20 text-xs"
                  >
                    <Save className="w-4.5 h-4.5" />
                    Save Preferences
                  </button>
                </div>
              </form>
            </div>

            {/* Read-Only Account Details */}
            <div className="settings-card glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-lg font-bold Outfit border-b border-base-content/5 pb-3">Corporate Account Specification</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Employee Name</span>
                  <p className="text-sm font-extrabold text-base-content mt-0.5">
                    {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Corporate Email</span>
                  <p className="text-sm font-semibold text-base-content mt-0.5">{user?.email}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">Employee Serial ID</span>
                  <p className="text-sm font-bold text-base-content mt-0.5">{user?.profile?.employee_id || 'N/A'}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-base-content/40 uppercase font-bold tracking-wider">System Role</span>
                  <p className="text-sm font-bold text-primary mt-0.5 uppercase tracking-wide">{roleDisplay}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Security & Corporate Org info */}
          <div className="space-y-6">
            {/* Organization profile */}
            <div className="settings-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold Outfit">Corporate Profile</h3>
                  <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-wider">Tenant Settings</p>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between border-b border-base-content/5 pb-2">
                  <span className="text-base-content/55 font-bold">Tenant Name</span>
                  <span className="font-extrabold text-base-content">{user?.organization?.name}</span>
                </div>
                <div className="flex justify-between border-b border-base-content/5 pb-2">
                  <span className="text-base-content/55 font-bold">Tenant Identifier</span>
                  <span className="font-bold text-primary">{user?.organization?.slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/55 font-bold">Assigned Department</span>
                  <span className="font-bold text-base-content">{user?.profile?.department?.name}</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="settings-card glass-panel p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-base font-bold Outfit flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Help & Security
              </h3>
              <div className="space-y-3 text-xs text-base-content/70 leading-relaxed font-medium">
                <p>
                  To change your account name, corporate email, or department assignments, please contact your System Administrator.
                </p>
                <p>
                  Session tokens are rotated automatically for security and persist for up to 7 days on this browser session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default SettingsPage;
