import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/shared/constants/roles';
import { useQuery } from '@tanstack/react-query';
import { pettyCashApi } from '@/features/petty-cash/api/pettyCashApi';
import { leaveApi } from '@/features/leave/api/leaveApi';
import { motion } from 'framer-motion';
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
  ChevronRight
} from 'lucide-react';

export function Sidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth();
  const role = user?.profile?.role || user?.role;

  // Query: Get pending approvals count for TL/CEO/Admin/GM/HR
  const { data: pettyCashPending } = useQuery({
    queryKey: ['sidebar-pending-petty-cash'],
    queryFn: async () => {
      const res = await pettyCashApi.list();
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
    refetchInterval: 20000,
  });

  const { data: leavePending } = useQuery({
    queryKey: ['sidebar-pending-leaves'],
    queryFn: async () => {
      const res = await leaveApi.listRequests();
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
    refetchInterval: 20000,
  });

  const pendingApprovalsCount = (pettyCashPending?.length || 0) + (leavePending?.length || 0);

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
      to: '/analytics', 
      label: 'Analytics', 
      icon: BarChart3,
      allowed: [ROLES.CEO, ROLES.ADMIN] 
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
      allowed: [ROLES.CEO, ROLES.ADMIN],
      allowHR: true
    },
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
          onClick={onToggle}
          className="btn btn-ghost btn-circle btn-sm hover:bg-base-content/10 hidden md:flex text-base-content"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 space-y-2.5 overflow-y-auto">
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
                    <span className="badge badge-error badge-sm ml-auto font-bold animate-pulse">
                      {pendingApprovalsCount}
                    </span>
                  )}
                  {isCollapsed && item.label === 'Approvals' && pendingApprovalsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error animate-ping"></span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom User profile card & Logout */}
      <div className={`p-4 border-t border-base-content/5 space-y-3 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-2 py-1 w-full`}>
          <div className="avatar placeholder shrink-0">
            <div className="bg-primary/10 text-primary rounded-lg w-10 h-10 border border-primary/20 flex items-center justify-center font-bold text-sm uppercase">
              {user?.username?.substring(0, 2)}
            </div>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-base-content truncate">
                {user?.first_name || user?.username}
              </p>
              <p className="text-[10px] text-base-content/40 font-semibold truncate uppercase tracking-wider">
                {roleDisplayOrRole(user)}
              </p>
            </div>
          )}
        </div>

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

function roleDisplayOrRole(user) {
  return user?.profile?.role_display || user?.profile?.role || user?.role;
}
