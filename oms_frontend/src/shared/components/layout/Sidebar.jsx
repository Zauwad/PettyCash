import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/shared/constants/roles';
import { 
  LayoutDashboard, 
  Wallet, 
  CalendarDays, 
  CheckSquare, 
  BarChart3, 
  Share2, 
  Users,
  LogOut 
} from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const role = user?.profile?.role;

  // Custom navigation items with roles authorization
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/petty-cash', label: 'Petty Cash', icon: Wallet },
    { to: '/leave', label: 'Leave management', icon: CalendarDays },
    { 
      to: '/approvals', 
      label: 'Approvals', 
      icon: CheckSquare,
      allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN] 
    },
    { 
      to: '/analytics', 
      label: 'Analytics', 
      icon: BarChart3,
      allowed: [ROLES.CEO, ROLES.ADMIN] 
    },
    { 
      to: '/delegation', 
      label: 'Delegation', 
      icon: Share2,
      allowed: [ROLES.TEAM_LEAD, ROLES.CEO] 
    },
    {
      to: '/team',
      label: 'Team Management',
      icon: Users,
      allowed: [ROLES.CEO, ROLES.ADMIN],
      allowHR: true
    },
  ];

  return (
    <aside className="hidden md:flex md:w-64 bg-base-200/50 backdrop-blur-md border-r border-base-content/5 flex-col md:h-screen sticky top-0 z-30">
      {/* Brand Logo & Name */}
      <div className="p-6 border-b border-base-content/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-primary uppercase Outfit">
            {user?.organization?.name || 'OMS Portal'}
          </h1>
          <p className="text-[10px] tracking-widest text-base-content/40 uppercase mt-0.5 font-bold">
            Operations Portal
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // Check role and HR department restrictions
          const isHR = user?.profile?.department?.name?.toUpperCase().includes('HR');
          const isAllowed = !item.allowed || item.allowed.includes(role) || (item.allowHR && isHR);
          if (!isAllowed) return null;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary text-primary-content shadow-lg shadow-primary/25 font-semibold'
                    : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content'
                }`
              }
            >
              <item.icon className="w-5 h-5 transition-transform group-hover:scale-110 duration-200" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom User profile card & Logout */}
      <div className="p-4 border-t border-base-content/5 space-y-3">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="avatar placeholder">
            <div className="bg-primary/10 text-primary rounded-lg w-10 h-10 border border-primary/20 flex items-center justify-center font-bold text-sm uppercase">
              {user?.username?.substring(0, 2)}
            </div>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-base-content truncate">
              {user?.first_name || user?.username}
            </p>
            <p className="text-[10px] text-base-content/40 font-semibold truncate uppercase tracking-wider">
              {role}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn btn-ghost btn-sm w-full rounded-lg text-error hover:bg-error/10 hover:text-error flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
