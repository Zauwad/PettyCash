import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin } from '../hooks/useLogin';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import gsap from 'gsap';
import { LogIn } from 'lucide-react';

// Client-side form validation rules
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters long'),
});

export function LoginForm() {
  const formRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
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

  return (
    <div 
      ref={formRef} 
      className="min-h-screen w-full flex items-center justify-center bg-radial from-base-200 to-base-300 px-4 relative overflow-hidden"
    >
      {/* Decorative gradient glowing bubbles in background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative z-10">
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
            <input
              type="password"
              className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 ${
                errors.password ? 'input-error' : ''
              }`}
              placeholder="••••••••"
              {...register('password')}
            />
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

        {/* Footer credentials hints */}
        <div className="anim-item mt-8 pt-6 border-t border-base-content/5 text-center">
          <p className="text-[10px] text-base-content/30 leading-relaxed uppercase tracking-wider">
            Demo Accounts password: <span className="font-semibold text-primary/70">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
