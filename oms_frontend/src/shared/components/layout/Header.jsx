import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/shared/api/notificationsApi';
import { Bell, Menu, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ToggleTheme } from '@/shared/components/ui/ToggleTheme';

export function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const departmentName = user?.profile?.department?.name || 'Central Office';
  const roleDisplay = user?.profile?.role_display || user?.profile?.role;

  // Query: Get notifications
  const { data: notifications } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 15000, // Poll every 15s for updates
    enabled: !!user,
  });

  const unreadCount = notifications?.results?.filter((n) => !n.is_read).length || 0;

  // Mutation: Mark as read
  const markReadMutation = useMutation({
    mutationFn: () => notificationsApi.markRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
    onError: () => {
      toast.error('Failed to mark notifications as read.');
    },
  });

  return (
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

        {/* Notification Bell Dropdown */}
        <div className="dropdown dropdown-end">
          <button 
            tabIndex={0} 
            className="btn btn-ghost btn-circle btn-sm text-base-content/75 hover:bg-base-content/5 relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="badge badge-primary badge-xs absolute top-1.5 right-1.5 border-0 font-black px-1.5 text-[8px] h-3.5 min-w-3.5">
                {unreadCount}
              </span>
            )}
          </button>
          <div 
            tabIndex={0} 
            className="dropdown-content card card-compact w-72 md:w-80 p-2 shadow-2xl bg-base-200 border border-base-content/10 rounded-2xl mt-3 text-xs glass-panel"
          >
            <div className="card-body">
              <div className="flex justify-between items-center border-b border-base-content/5 pb-2">
                <h3 className="font-bold text-sm Outfit">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => markReadMutation.mutate()}
                    disabled={markReadMutation.isPending}
                    className="btn btn-ghost btn-xs text-primary font-bold gap-1 rounded-md text-[10px]"
                  >
                    <Check className="w-3 h-3" />
                    Mark Read
                  </button>
                )}
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2.5 py-2">
                {notifications?.results?.length > 0 ? (
                  notifications.results.slice(0, 5).map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-2.5 rounded-xl border transition-colors ${
                        item.is_read 
                          ? 'bg-transparent border-transparent' 
                          : 'bg-primary/5 border-primary/10'
                      }`}
                    >
                      <h4 className="font-bold text-base-content leading-normal">{item.title}</h4>
                      <p className="text-base-content/65 mt-0.5 leading-normal">{item.message}</p>
                      {item.action_url && (
                        <Link 
                          to={item.action_url} 
                          className="text-primary hover:underline font-bold mt-1.5 block text-[10px]"
                        >
                          View Action details
                        </Link>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-base-content/35 font-semibold">
                    No new alerts or notifications.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User profile dropdown summary */}
        <div className="flex items-center gap-2 border-l border-base-content/10 pl-4">
          <div className="text-right hidden sm:block">
            <h4 className="text-xs font-bold text-base-content">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
            </h4>
            <span className="text-[10px] text-base-content/50 font-medium tracking-wide">
              {roleDisplay}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

