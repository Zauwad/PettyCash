import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/shared/constants/roles';
import { X, LogOut } from 'lucide-react';

export function MobileNav({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const role = user?.profile?.role;

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/petty-cash', label: 'Petty Cash' },
    { to: '/leave', label: 'Leave Management' },
    { to: '/approvals', label: 'Approvals', allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.HR] },
    { to: '/analytics', label: 'Analytics', allowed: [ROLES.CEO, ROLES.ADMIN] },
    { to: '/delegation', label: 'Delegation', allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.GENERAL_MANAGER] },
    { to: '/team', label: 'Team Management', allowed: [ROLES.CEO, ROLES.ADMIN], allowHR: true },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden animate-fade-in">
      {/* Dark backdrop blur */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Sliding nav drawer */}
      <div className="relative flex flex-col max-w-xs w-full bg-base-200/95 backdrop-blur-md p-6 shadow-2xl h-full border-r border-base-content/5 transition-transform duration-300 transform translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-base-content/5 pb-4">
          <div>
            <h2 className="text-lg font-black tracking-tight text-primary uppercase Outfit">
              {user?.organization?.name || 'OMS'}
            </h2>
            <p className="text-[10px] tracking-widest text-base-content/40 uppercase font-bold mt-0.5">
              Portal Nav
            </p>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm hover:bg-base-content/10"
          >
            <X className="w-5 h-5 text-base-content" />
          </button>
        </div>

        {/* Links list */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isHR = user?.profile?.department?.name?.toUpperCase().includes('HR');
            const isAllowed = !item.allowed || item.allowed.includes(role) || (item.allowHR && isHR);
            if (!isAllowed) return null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary text-primary-content shadow-lg shadow-primary/20' 
                      : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content'
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile Card & Logout */}
        <div className="pt-4 border-t border-base-content/5 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="avatar placeholder">
              <div className="bg-primary/10 text-primary rounded-lg w-10 h-10 border border-primary/20 flex items-center justify-center font-bold text-sm uppercase">
                {user?.username?.substring(0, 2)}
              </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-base-content truncate">
                {user?.first_name || user?.username}
              </p>
              <p className="text-[10px] text-base-content/40 font-bold truncate uppercase tracking-wider">
                {role}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="btn btn-ghost btn-sm w-full rounded-lg text-error hover:bg-error/10 hover:text-error flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
export default MobileNav;
