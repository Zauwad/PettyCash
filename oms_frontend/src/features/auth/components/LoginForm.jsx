import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin } from '../hooks/useLogin';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import gsap from 'gsap';
import { 
  LogIn, 
  Download, 
  ShieldCheck, 
  KeyRound, 
  Briefcase, 
  UserCheck, 
  Users, 
  User, 
  Sparkles,
  Building2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Spotlight } from '@/shared/components/ui/Spotlight';
import { ToggleTheme } from '@/components/lightswind/toggle-theme';

// Client-side form validation rules
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters long'),
});

// Seed Demo Credential Profiles
const DEMO_TENANTS = [
  {
    id: 'amaze',
    name: 'A Maze Venture',
    shortName: 'A Maze',
    roles: [
      { label: 'CEO', username: 'amaze_ceo', icon: ShieldCheck, colorClass: 'border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-content' },
      { label: 'Admin', username: 'amaze_admin', icon: KeyRound, colorClass: 'border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-content' },
      { label: 'GM', username: 'amaze_gm', icon: Briefcase, colorClass: 'border-accent/40 bg-accent/10 text-accent hover:bg-accent hover:text-accent-content' },
      { label: 'HR / Disburser', username: 'amaze_hr', icon: UserCheck, colorClass: 'border-info/40 bg-info/10 text-info hover:bg-info hover:text-info-content' },
      { label: 'Team Lead', username: 'amaze_lead', icon: Users, colorClass: 'border-warning/40 bg-warning/10 text-warning hover:bg-warning hover:text-warning-content' },
      { label: 'Staff', username: 'amaze_vent_emp1', icon: User, colorClass: 'border-base-content/20 bg-base-content/5 text-base-content/80 hover:bg-base-content hover:text-base-100' },
    ],
  },
  {
    id: 'braincount',
    name: 'Braincount',
    shortName: 'Braincount',
    roles: [
      { label: 'CEO', username: 'braincount_ceo', icon: ShieldCheck, colorClass: 'border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-content' },
    ],
  },
  {
    id: 'mynt',
    name: 'mYnt Connect',
    shortName: 'mYnt Connect',
    roles: [
      { label: 'CEO', username: 'mynt_ceo', icon: ShieldCheck, colorClass: 'border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-content' },
    ],
  },
];

export function LoginForm() {
  const formRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();

  const [activeTab, setActiveTab] = useState('amaze');
  const [showPassword, setShowPassword] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // GSAP stagger-in animations on mount
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.anim-item',
        { y: 30, opacity: 0, filter: 'blur(5px)' },
        { 
          y: 0, 
          opacity: 1, 
          filter: 'blur(0px)', 
          stagger: 0.08, 
          duration: 0.6, 
          ease: 'power3.out' 
        }
      );
    }, formRef);

    return () => ctx.revert();
  }, []);

  const handleQuickFill = (role, tenantName) => {
    setValue('username', role.username, { shouldValidate: true, shouldDirty: true });
    setValue('password', 'password123', { shouldValidate: true, shouldDirty: true });
    toast.info(`Filled credentials for ${tenantName} (${role.label})`, {
      icon: <Sparkles className="w-4 h-4 text-primary animate-pulse" />,
      duration: 2500,
    });
  };

  const onSubmit = (data) => {
    loginMutation.mutate(data, {
      onSuccess: (res) => {
        const orgName = res.user?.organization?.name || 'Portal';
        toast.success(`Welcome back! Logged into ${orgName}.`);
        
        // Redirect to target path or home dashboard
        const redirectPath = location.state?.from?.pathname || '/';
        navigate(redirectPath, { replace: true });
      },
      onError: (err) => {
        const errMsg = err.response?.data?.detail || 'Invalid username or password.';
        toast.error(errMsg);
      },
    });
  };

  const selectedTenant = DEMO_TENANTS.find((t) => t.id === activeTab) || DEMO_TENANTS[0];

  return (
    <div 
      ref={formRef} 
      className="min-h-screen w-full flex items-center justify-center bg-base-100 px-4 py-8 relative overflow-hidden"
    >
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-50">
        <ToggleTheme 
          animationType="swipe-left" 
          className="btn btn-ghost btn-circle text-base-content" 
        />
      </div>
      {/* Aceternity Grid Background */}
      <div className="absolute inset-0 bg-grid-aceternity pointer-events-none" />
      
      {/* Radial gradient mask for container to give a faded look */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-base-100 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      <Spotlight className="-top-30 -left-20 md:left-80 md:-top-40 z-10" fill="var(--color-primary)" />
      
      {/* Decorative gradient glowing bubbles in background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative z-5">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="anim-item bg-primary/10 p-3 rounded-xl mb-4 border border-primary/20">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <h2 className="anim-item text-3xl font-extrabold tracking-tight text-base-content">
            OMS Gateway
          </h2>
          <p className="anim-item text-xs font-medium text-base-content/55 mt-2">
            Operations Management System multi-tenant access
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="anim-item">
            <label className="label text-xs font-semibold tracking-wide text-base-content/70">
              USERNAME / EMAIL
            </label>
            <input
              type="text"
              className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 ${
                errors.username ? 'input-error' : ''
              }`}
              placeholder="e.g. amaze_ceo"
              {...register('username')}
            />
            {errors.username && (
              <span className="text-xs text-error font-medium mt-1 block">
                {errors.username.message}
              </span>
            )}
          </div>

          <div className="anim-item">
            <label className="label text-xs font-semibold tracking-wide text-base-content/70">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 pr-10 ${
                  errors.password ? 'input-error' : ''
                }`}
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer z-10 text-base-content/50 hover:text-base-content transition-colors p-1 rounded-lg focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-base-content/60" />
                ) : (
                  <Eye className="w-4 h-4 text-base-content/60" />
                )}
              </button>
            </div>
            {errors.password && (
              <span className="text-xs text-error font-medium mt-1 block">
                {errors.password.message}
              </span>
            )}
          </div>

          <div className="anim-item pt-2">
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="btn btn-primary w-full rounded-xl shadow-lg border-0 transition-transform active:scale-95 duration-200"
            >
              {loginMutation.isPending ? (
                <span className="loading loading-spinner"></span>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        {/* Recruiter / Quick Demo Credentials Selector */}
        <div className="anim-item mt-8 pt-6 border-t border-base-content/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              Quick Demo Access
            </span>
            <span className="text-[10px] text-base-content/40 font-mono">
              pwd: password123
            </span>
          </div>

          {/* Company Tabs */}
          <div className="flex rounded-xl bg-base-200/60 p-1 mb-3.5 gap-1 border border-base-content/5">
            {DEMO_TENANTS.map((tenant) => {
              const isActive = activeTab === tenant.id;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => setActiveTab(tenant.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold pointer-events-auto cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-base-100 text-primary shadow-sm border border-primary/20'
                      : 'text-base-content/60 hover:text-base-content hover:bg-base-100/40'
                  }`}
                >
                  {tenant.shortName}
                </button>
              );
            })}
          </div>

          {/* Role Pill Badges */}
          <div className="flex flex-wrap gap-1.5">
            {selectedTenant.roles.map((role) => {
              const RoleIcon = role.icon;
              return (
                <button
                  key={role.username}
                  type="button"
                  onClick={() => handleQuickFill(role, selectedTenant.name)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium pointer-events-auto cursor-pointer transition-all duration-200 active:scale-95 shadow-sm ${role.colorClass}`}
                  title={`Click to fill credentials for ${role.username}`}
                >
                  <RoleIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating PWA Install Button (Bottom Left Corner) */}
      {isInstallable && (
        <div className="absolute bottom-6 left-6 z-50">
          <button
            onClick={handleInstallClick}
            className="btn btn-sm btn-outline rounded-xl flex items-center gap-1.5 bg-base-100/50 hover:bg-primary border-base-content/10 text-xs font-bold text-base-content hover:text-primary-content hover:border-primary shadow-lg backdrop-blur-md transition-all duration-200 active:scale-95"
          >
            <Download className="w-3.5 h-3.5 animate-bounce" />
            Install OMS Portal
          </button>
        </div>
      )}
    </div>
  );
}

