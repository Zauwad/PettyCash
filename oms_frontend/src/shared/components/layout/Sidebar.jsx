import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/shared/constants/roles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pettyCashApi } from '@/features/petty-cash/api/pettyCashApi';
import { leaveApi } from '@/features/leave/api/leaveApi';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  Wallet, 
  CalendarDays, 
  CheckSquare, 
  BarChart3, 
  Share2, 
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarClock,
  CalendarRange,
  Activity,
} from 'lucide-react';

// Roles that can access analytics & reports
const ANALYTICS_ROLES = [ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.TEAM_LEAD, ROLES.HR];

export function Sidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth();
  const role = user?.profile?.role || user?.role;
  const location = useLocation();
  const isHR = role === ROLES.HR;

  // Whether the analytics sub-menu is expanded
  const isAnalyticsActive = location.pathname.startsWith('/analytics');
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);

  const queryClient = useQueryClient();

  // Query: Get pending approvals count for TL/CEO/Admin/GM/HR (refetchInterval removed)
  const { data: pettyCashPending } = useQuery({
    queryKey: ['pending-petty-cash'],
    queryFn: async () => {
      const res = await pettyCashApi.list({ page_size: 100 });
      return res.results?.filter(r => {
        const isOwner = r.requester_email === user?.email;
        if (isOwner) return false;

        if (role === ROLES.TEAM_LEAD) {
          return r.state === 'pending_tl_approval';
        }
        if (role === ROLES.CEO || role === ROLES.ADMIN) {
          return r.state === 'pending_ceo_approval';
        }
        if (role === ROLES.HR) {
          return r.state === 'pending_hr_disbursement' || r.state === 'partially_disbursed';
        }
        return false;
      }) || [];
    },
    enabled: !!user && [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.HR].includes(role),
  });

  const { data: leavePending } = useQuery({
    queryKey: ['pending-leaves'],
    queryFn: async () => {
      const res = await leaveApi.listRequests({ page_size: 100 });
      return res.results?.filter(r => {
        const isOwner = r.requester_name === user?.first_name + ' ' + (user?.last_name || '') || r.requester_name === user?.username;
        if (isOwner) return false;

        if (role === ROLES.TEAM_LEAD) {
          return r.state === 'pending_tl_approval';
        }
        if (role === ROLES.GENERAL_MANAGER) {
          return r.state === 'pending_gm_approval';
        }
        return false;
      }) || [];
    },
    enabled: !!user && [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.HR].includes(role),
  });

  const pendingApprovalsCount = (pettyCashPending?.length || 0) + (leavePending?.length || 0);

  const handleToggle = () => {
    onToggle();
    // Manual query refresh trigger: user opens/collapses sidebar
    queryClient.invalidateQueries({ queryKey: ['pending-petty-cash'] });
    queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
  };

  // Check if the current user can see analytics
  const canSeeAnalytics = ANALYTICS_ROLES.includes(role);

  // Custom navigation items with roles authorization
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/petty-cash', label: 'Petty Cash', icon: Wallet },
    { to: '/leave', label: 'Leave Management', icon: CalendarDays },
    { 
      to: '/approvals', 
      label: 'Approvals', 
      icon: CheckSquare,
      allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.ADMIN, ROLES.GENERAL_MANAGER, ROLES.HR] 
    },
    { 
      to: '/delegation', 
      label: 'Delegation', 
      icon: Share2,
      allowed: [ROLES.TEAM_LEAD, ROLES.CEO, ROLES.GENERAL_MANAGER] 
    },
    {
      to: '/team',
      label: 'Team Management',
      icon: Users,
      allowed: [ROLES.CEO, ROLES.ADMIN, ROLES.HR],
      allowHR: true
    },
  ];

  const analyticsSubLinks = [
    { to: '/analytics', label: 'Overview', icon: BarChart3, exact: true },
    { to: '/analytics/weekly', label: 'Weekly', icon: CalendarClock },
    { to: '/analytics/monthly', label: 'Monthly', icon: CalendarRange },
    { to: '/analytics/quarterly', label: 'Quarterly', icon: Activity },
  ];

  return (
    <aside className={`hidden md:flex bg-base-200/50 backdrop-blur-md border-r border-base-content/5 flex-col md:h-screen sticky top-0 z-30 transition-all duration-300 ${
      isCollapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Brand Logo & Name */}
      <div className={`p-6 border-b border-base-content/5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div>
            <h1 className="text-lg font-black tracking-tight text-primary uppercase Outfit">
              {user?.organization?.name || 'OMS Portal'}
            </h1>
            <p className="text-[9px] tracking-widest text-base-content/40 uppercase mt-0.5 font-bold">
              Operations Portal
            </p>
          </div>
        )}
        <button 
          onClick={handleToggle}
          className="btn btn-ghost btn-circle btn-sm hover:bg-base-content/10 hidden md:flex text-base-content"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isAllowed = !item.allowed || item.allowed.includes(role) || (item.allowHR && isHR);
          if (!isAllowed) return null;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex items-center ${isCollapsed ? 'justify-center p-3 tooltip tooltip-right' : 'gap-3 px-4 py-3'} rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'text-primary-content font-semibold shadow-md'
                    : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content'
                }`
              }
              data-tip={isCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebarActivePill"
                      className="absolute inset-0 bg-primary rounded-xl -z-10 shadow-lg shadow-primary/20"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon className="w-5 h-5 transition-transform group-hover:scale-110 duration-200 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                  
                  {/* Pending count badges */}
                  {!isCollapsed && item.label === 'Approvals' && pendingApprovalsCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-auto font-bold animate-pulse text-[10px] px-1.5 py-0 leading-none h-5 rounded-md border-0"
                    >
                      {pendingApprovalsCount}
                    </Badge>
                  )}
                  {isCollapsed && item.label === 'Approvals' && pendingApprovalsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error animate-ping"></span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* ─── Analytics Section (collapsible) ─────────────────── */}
        {canSeeAnalytics && (
          <div className="space-y-1">
            {/* Analytics parent button */}
            {isCollapsed ? (
              // Collapsed: show icon-only link to /analytics overview
              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  `relative flex items-center justify-center p-3 tooltip tooltip-right rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isAnalyticsActive
                      ? 'text-primary-content font-semibold shadow-md'
                      : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content'
                  }`
                }
                data-tip="Analytics"
              >
                {isAnalyticsActive && (
                  <motion.span
                    layoutId="sidebarActivePill"
                    className="absolute inset-0 bg-primary rounded-xl -z-10 shadow-lg shadow-primary/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <BarChart3 className="w-5 h-5 transition-transform group-hover:scale-110 duration-200 shrink-0" />
              </NavLink>
            ) : (
              <>
                {/* Expandable toggle button */}
                <button
                  id="analytics-sidebar-toggle"
                  onClick={() => setAnalyticsOpen((prev) => !prev)}
                  className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isAnalyticsActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 transition-transform group-hover:scale-110 duration-200 shrink-0" />
                  <span>Analytics</span>
                  <motion.span
                    className="ml-auto"
                    animate={{ rotate: analyticsOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4 text-base-content/50" />
                  </motion.span>
                </button>

                {/* Sub-link list */}
                <AnimatePresence initial={false}>
                  {analyticsOpen && (
                    <motion.div
                      key="analytics-submenu"
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
                            className={({ isActive }) =>
                              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                isActive
                                  ? 'bg-primary text-primary-content shadow-sm'
                                  : 'text-base-content/65 hover:bg-base-content/5 hover:text-base-content'
                              }`
                            }
                          >
                            <sub.icon className="w-3.5 h-3.5 shrink-0" />
                            {sub.label}
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        )}
        {/* ──────────────────────────────────────────────────────── */}
      </nav>

      {/* Bottom Logout */}
      <div className={`p-4 border-t border-base-content/5 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
        <button
          onClick={logout}
          className={`btn btn-ghost btn-sm rounded-lg text-error hover:bg-error/10 hover:text-error flex items-center justify-center gap-2 ${
            isCollapsed ? 'w-10 h-10 p-0 tooltip tooltip-right' : 'w-full'
          }`}
          data-tip={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
