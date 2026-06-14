import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/shared/constants/roles';
import { X, LogOut, BarChart3, ChevronDown, CalendarClock, CalendarRange, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ANALYTICS_ROLES = [ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.TEAM_LEAD, ROLES.HR];

export function MobileNav({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const role = user?.profile?.role;
  const location = useLocation();
  const isHR = role === ROLES.HR || user?.profile?.department?.name?.toUpperCase().includes('HR');
  const isAnalyticsActive = location.pathname.startsWith('/analytics');
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);
  const canSeeAnalytics = ANALYTICS_ROLES.includes(role);

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/petty-cash', label: 'Petty Cash' },
    { to: '/leave', label: 'Leave Management' },
    { to: '/approvals', label: 'Approvals', allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.HR] },
    { to: '/delegation', label: 'Delegation', allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.GENERAL_MANAGER] },
    { to: '/team', label: 'Team Management', allowed: [ROLES.CEO, ROLES.ADMIN, ROLES.HR], allowHR: true },
  ];

  const analyticsSubLinks = [
    { to: '/analytics', label: 'Overview', exact: true },
    { to: '/analytics/weekly', label: 'Weekly Report' },
    { to: '/analytics/monthly', label: 'Monthly Report' },
    { to: '/analytics/quarterly', label: 'Quarterly Report' },
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
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isAllowed = !item.allowed || item.allowed.includes(role) || (item.allowHR && isHR);
            if (!isAllowed) return null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
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

          {/* ─── Analytics Accordion ─────────────────────── */}
          {canSeeAnalytics && (
            <div className="space-y-1">
              <button
                id="mobile-analytics-toggle"
                onClick={() => setAnalyticsOpen((p) => !p)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isAnalyticsActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Analytics</span>
                <motion.span
                  className="ml-auto"
                  animate={{ rotate: analyticsOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-base-content/50" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {analyticsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 pl-3 border-l border-base-content/10 space-y-1 py-1">
                      {analyticsSubLinks.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          end={sub.exact}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                              isActive
                                ? 'bg-primary text-primary-content shadow-sm'
                                : 'text-base-content/65 hover:bg-base-content/5 hover:text-base-content'
                            }`
                          }
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {/* ─────────────────────────────────────────────── */}
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
