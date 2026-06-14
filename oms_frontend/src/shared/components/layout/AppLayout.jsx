import { useState } from 'react';
import { useLocation, useOutlet, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { SpotlightNew } from '@/shared/components/ui/SpotlightNew';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Zap, Plus, CalendarDays, CheckSquare, Users, X } from 'lucide-react';

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('isSidebarCollapsed') === 'true';
  });

  const { user } = useAuth();
  const role = user?.profile?.role || user?.role;
  const isCEO = role === 'CEO';
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const quickActions = [
    {
      to: '/petty-cash?create=true',
      label: 'New Requisition',
      icon: Plus,
      show: !isCEO && role !== 'ADMIN',
    },
    {
      to: '/leave?create=true',
      label: 'Apply Leave',
      icon: CalendarDays,
      show: !isCEO,
    },
    {
      to: '/approvals',
      label: 'Approvals Desk',
      icon: CheckSquare,
      show: ['TEAM_LEAD', 'CEO', 'ADMIN', 'GENERAL_MANAGER', 'HR'].includes(role),
    },
    {
      to: '/team',
      label: 'Team Directory',
      icon: Users,
      show: ['CEO', 'ADMIN', 'HR'].includes(role),
    },
  ].filter(action => action.show);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('isSidebarCollapsed', String(next));
      return next;
    });
  };

  const location = useLocation();
  const outlet = useOutlet();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-base-100 font-sans text-base-content overflow-hidden">
      {/* Primary Sidebar Navigation (desktop only) */}
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Workspace Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Toolbar Header with Hamburger menu action */}
        <Header onMenuToggle={() => setIsMobileMenuOpen(true)} />

        {/* Dynamic Route Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-tr from-base-300/30 via-base-100 to-base-100 relative">
          <SpotlightNew />

          <div className="max-w-7xl mx-auto w-full relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="w-full"
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Quick Actions FAB */}
      {user && quickActions.length > 0 && (
        <div className="fixed bottom-12 right-6 z-50 md:hidden flex flex-col items-end gap-3">
          <AnimatePresence>
            {isQuickActionsOpen && (
              <>
                {/* Backdrop Blur Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
                />

                {/* Actions List */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  transition={{ type: 'spring', duration: 0.3 }}
                  className="flex flex-col items-end gap-3 z-50 mb-2"
                >
                  <span className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider mr-2 bg-base-200/80 px-2 py-0.5 rounded-md backdrop-blur-md">Quick Actions</span>
                  {quickActions.map((action, idx) => (
                    <motion.div
                      key={action.to}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Link
                        to={action.to}
                        onClick={() => setIsQuickActionsOpen(false)}
                        className="flex items-center gap-3 bg-base-200/95 border border-base-content/10 px-4 py-3 rounded-2xl shadow-xl hover:bg-base-200 text-sm font-semibold text-base-content backdrop-blur-md transition-all active:scale-95"
                      >
                        <span>{action.label}</span>
                        <div className="bg-primary/10 text-primary p-2 rounded-xl">
                          <action.icon className="w-4 h-4" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Floating Trigger Button */}
          <motion.button
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            whileTap={{ scale: 0.9 }}
            className={`btn btn-circle shadow-2xl z-50 border-0 flex items-center justify-center ${
              isQuickActionsOpen 
                ? 'bg-base-content text-base-100 hover:bg-base-content' 
                : 'bg-primary text-primary-content hover:bg-primary/90'
            }`}
          >
            <motion.div
              animate={{ rotate: isQuickActionsOpen ? 135 : 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex items-center justify-center"
            >
              <Plus className="w-6 h-6" />
            </motion.div>
          </motion.button>
        </div>
      )}
    </div>
  );
}
export default AppLayout;
