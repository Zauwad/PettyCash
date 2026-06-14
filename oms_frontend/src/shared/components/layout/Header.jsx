import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/shared/api/notificationsApi';
import { Bell, Menu, Check, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ToggleTheme } from '@/components/lightswind/toggle-theme';
import { Badge } from '@/components/ui/badge';


export function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const departmentName = user?.profile?.department?.name || 'Central Office';
  const roleDisplay = user?.profile?.role_display || user?.profile?.role;

  // Query: Get notifications
  const { data: notifications } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 25000, // Poll every 25s for updates
    enabled: !!user,
  });

  const unreadCount = notifications?.results?.filter((n) => !n.is_read).length || 0;

  // Mutation: Mark all as read
  const markReadMutation = useMutation({
    mutationFn: (notificationIds = []) => notificationsApi.markRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-notifications'] });
      toast.success('Notifications updated.');
    },
    onError: () => {
      toast.error('Failed to mark notifications as read.');
    },
  });

  // Filter notifications list
  const filteredNotifications = notifications?.results?.filter(item => {
    if (filter === 'unread') return !item.is_read;
    return true;
  }) || [];

  const formatRelativeTime = (dateStr) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch (_e) {
      return 'just now';
    }
  };

  return (
    <>
      {/* Animation Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}} />

      <header className="h-16 border-b border-base-content/5 bg-base-100/50 backdrop-blur-md flex items-center justify-between px-6 z-20 sticky top-0">
        {/* Left items: mobile menu trigger & department summary */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuToggle}
            className="btn btn-ghost btn-circle btn-sm md:hidden text-base-content"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-base-300 border border-base-content/10 text-base-content/70 uppercase tracking-wider hidden xs:inline-block">
            {departmentName}
          </span>
        </div>

        {/* Right items: Theme toggle, Notifications and Profile summary */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle Button */}
          <ToggleTheme 
            animationType="swipe-left" 
            className="btn btn-ghost btn-circle btn-sm" 
          />

          {/* Notification Bell Trigger */}
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="btn btn-ghost btn-circle btn-sm text-base-content/75 hover:bg-base-content/5 relative"
            title="Notifications Panel"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="default" 
                className="absolute top-1 right-1 border-0 font-black text-[8px] h-3.5 min-w-3.5 flex items-center justify-center p-0 rounded-full"
              >
                {unreadCount}
              </Badge>
            )}
          </button>

          {/* User profile dropdown summary */}
          <div className="flex items-center gap-3 border-l border-base-content/10 pl-4">
            {user?.profile?.avatar_url ? (
              <img 
                src={user.profile.avatar_url} 
                alt={user.first_name || user.username} 
                className="w-8 h-8 rounded-full object-cover border border-primary/20 shrink-0"
              />
            ) : (
              <div className="bg-primary/10 text-primary rounded-full w-8 h-8 border border-primary/20 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                {user?.first_name 
                  ? (user.first_name[0] + (user.last_name ? user.last_name[0] : '')).toUpperCase() 
                  : user?.username?.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="text-left hidden sm:block">
              <h4 className="text-xs font-bold text-base-content leading-tight">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
              </h4>
              <span className="text-[10px] text-base-content/50 font-medium tracking-wide block mt-0.5">
                {roleDisplay}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-over Notification Drawer */}
      {isDrawerOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop blur */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />
          
          {/* Slide panel */}
          <div className="relative w-full max-w-md bg-base-200/98 backdrop-blur-md shadow-2xl h-full border-l border-base-content/5 flex flex-col z-10 animate-slide-in-right glass-panel">
            {/* Drawer Header */}
            <div className="p-6 border-b border-base-content/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold Outfit text-base-content">Notifications</h3>
                <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">Alerts & Actions</p>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="btn btn-ghost btn-circle btn-sm hover:bg-base-content/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content list & filters */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tab Selector & Mark Read Action */}
              <div className="flex items-center gap-2 border-b border-base-content/5 pb-4">
                <div className="tabs tabs-box bg-base-100/40 p-0.5 rounded-lg border border-base-content/5 flex">
                  <button 
                    onClick={() => setFilter('all')}
                    className={`rounded-md text-[10px] font-bold px-3 py-1.5 transition-colors ${
                      filter === 'all' 
                        ? 'bg-primary text-primary-content shadow-sm' 
                        : 'text-base-content/60 hover:text-base-content'
                    }`}
                  >
                    All ({notifications?.results?.length || 0})
                  </button>
                  <button 
                    onClick={() => setFilter('unread')}
                    className={`rounded-md text-[10px] font-bold px-3 py-1.5 transition-colors ${
                      filter === 'unread' 
                        ? 'bg-primary text-primary-content shadow-sm' 
                        : 'text-base-content/60 hover:text-base-content'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                {unreadCount > 0 && (
                  <button 
                    onClick={() => markReadMutation.mutate()}
                    disabled={markReadMutation.isPending}
                    className="btn btn-ghost btn-xs text-primary font-bold ml-auto rounded-md text-[10px] gap-1 hover:bg-primary/5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Feed items */}
              <div className="space-y-3">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 relative ${
                        item.is_read 
                          ? 'bg-transparent border-base-content/5' 
                          : 'bg-primary/5 border-primary/10 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-base-content leading-snug">{item.title}</h4>
                          <p className="text-xs text-base-content/65 leading-normal">{item.message}</p>
                        </div>
                        {!item.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate([item.id])}
                            className="btn btn-ghost btn-circle btn-xs text-primary hover:bg-primary/10 shrink-0 mt-0.5"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-base-content/5 pt-3 mt-1">
                        <span className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider">
                          {formatRelativeTime(item.created_at)}
                        </span>
                        {item.action_url && (
                          <Link 
                            to={item.action_url} 
                            onClick={() => setIsDrawerOpen(false)}
                            className="text-primary hover:underline font-bold flex items-center gap-1 text-[10px]"
                          >
                            View details
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-base-content/35 font-semibold flex flex-col items-center justify-center">
                    <Bell className="w-10 h-10 mb-2 opacity-25" />
                    <p className="text-xs">No alerts in this category.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}