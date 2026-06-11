import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { teamApi } from '../api/teamApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { ROLES } from '@/shared/constants/roles';
import { toast } from 'sonner';
import { 
  Users, 
  Search, 
  Building2, 
  ShieldAlert, 
  UserCog, 
  RefreshCw,
  UserCheck
} from 'lucide-react';

export function TeamPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Fetch all organization users
  const { data: usersData, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['organization-users'],
    queryFn: () => teamApi.getUsers(),
  });

  // Role change mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => teamApi.changeRole(userId, role),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries(['organization-users']);
      const name = updatedUser.first_name ? `${updatedUser.first_name} ${updatedUser.last_name || ''}` : updatedUser.username;
      toast.success(`Role updated successfully for ${name}!`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update employee role.');
    }
  });

  const users = usersData?.results || usersData || [];

  // Get list of unique departments within the fetched users for filtering
  const departments = ['ALL', ...new Set(users.map(u => u.profile?.department?.name).filter(Boolean))];

  // Filter users based on search query and department
  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const username = (user.username || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const empId = (user.profile?.employee_id || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = fullName.includes(query) || username.includes(query) || email.includes(query) || empId.includes(query);
    const matchesDept = selectedDept === 'ALL' || user.profile?.department?.name === selectedDept;

    return matchesSearch && matchesDept;
  });

  // Stagger animations for list
  const listRef = useGSAPStagger('.employee-row', [isLoading, filteredUsers.length]);

  const handleRoleChange = (userId, newRole) => {
    changeRoleMutation.mutate({ userId, role: newRole });
  };

  const isActorAdmin = currentUser?.profile?.role === ROLES.ADMIN;

  return (
    <PageTransition>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-content/5 pb-5">
          <div>
            <h2 className="text-3xl font-extrabold Outfit tracking-tight">Team Directory</h2>
            <p className="text-sm text-base-content/55">View all employees in your organization and manage role clearances.</p>
          </div>
          <button 
            onClick={() => refetch()} 
            disabled={isLoading || isRefetching}
            className="btn btn-ghost btn-sm rounded-xl gap-2 font-bold text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoading || isRefetching) ? 'animate-spin' : ''}`} />
            Refresh Directory
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-base-200/40 border border-base-content/5 p-4 rounded-2xl backdrop-blur-md">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search by name, email, or employee serial ID..."
              className="input input-bordered w-full pl-11 rounded-xl bg-base-100/45 focus:bg-base-100 border-base-content/10 text-xs h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Building2 className="w-4 h-4 text-base-content/40 shrink-0" />
            <select
              className="select select-bordered select-sm rounded-xl h-10 border-base-content/10 bg-base-100/45 focus:bg-base-100 text-xs w-full md:w-56"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'ALL' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Employees Table Container */}
        {isLoading ? (
          <div className="space-y-4">
            <LoadingSkeleton className="h-16 rounded-xl" />
            <LoadingSkeleton className="h-16 rounded-xl" />
            <LoadingSkeleton className="h-16 rounded-xl" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl space-y-3 shadow-md">
            <Users className="w-12 h-12 text-base-content/25 mx-auto" />
            <h3 className="text-lg font-bold Outfit">No employees found</h3>
            <p className="text-xs text-base-content/50 max-w-sm mx-auto">
              We couldn't find any team members matching your search query or selected department filter.
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-base-content/5">
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="bg-base-300/40 text-base-content/70 font-extrabold uppercase tracking-wider text-[10px] border-b border-base-content/5">
                    <th className="py-4 pl-6">Employee Details</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Clearance Role</th>
                    <th className="text-right pr-6">Manage Access</th>
                  </tr>
                </thead>
                <tbody ref={listRef}>
                  {filteredUsers.map((emp) => {
                    const isSelf = emp.id === currentUser?.id;
                    const empName = emp.first_name ? `${emp.first_name} ${emp.last_name || ''}` : emp.username;
                    const currentRole = emp.profile?.role;
                    
                    // Decide if current user can edit this employee's role
                    const canEdit = !isSelf && (currentRole !== ROLES.ADMIN || isActorAdmin);

                    return (
                      <tr key={emp.id} className="employee-row hover:bg-base-200/35 transition-colors border-b border-base-content/5">
                        <td className="py-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="avatar placeholder">
                              <div className="bg-primary/10 text-primary border border-primary/20 rounded-xl w-10 h-10 font-bold text-xs uppercase">
                                {emp.username?.substring(0, 2)}
                              </div>
                            </div>
                            <div>
                              <p className="font-extrabold text-sm text-base-content flex items-center gap-1.5">
                                {empName}
                                {isSelf && (
                                  <span className="badge badge-primary badge-xs rounded font-bold uppercase tracking-wider scale-90 px-1.5">You</span>
                                )}
                              </p>
                              <p className="text-[10px] text-base-content/40 font-semibold">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="font-bold text-base-content/75">
                          {emp.profile?.employee_id || 'N/A'}
                        </td>
                        <td>
                          <span className="badge badge-ghost font-bold rounded-lg px-2.5 py-1">
                            {emp.profile?.department?.name || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge font-bold uppercase tracking-wider rounded-lg px-2.5 py-1 ${
                            currentRole === ROLES.ADMIN ? 'badge-error text-error-content' :
                            currentRole === ROLES.CEO ? 'badge-secondary text-secondary-content' :
                            currentRole === ROLES.TEAM_LEAD ? 'badge-primary text-primary-content' :
                            'badge-ghost text-base-content/65'
                          }`}>
                            {emp.profile?.role_display || currentRole}
                          </span>
                        </td>
                        <td className="text-right pr-6">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-2">
                              <UserCog className="w-4 h-4 text-base-content/30" />
                              <select
                                className="select select-bordered select-xs rounded-lg text-[11px] h-8 bg-base-100/40 border-base-content/10 font-bold w-36"
                                value={currentRole}
                                onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                                disabled={changeRoleMutation.isPending}
                              >
                                <option value={ROLES.EMPLOYEE}>Employee</option>
                                <option value={ROLES.TEAM_LEAD}>Team Lead</option>
                                <option value={ROLES.CEO}>CEO</option>
                                {isActorAdmin && (
                                  <option value={ROLES.ADMIN}>Global Admin</option>
                                )}
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 text-base-content/40 font-medium select-none">
                              {isSelf ? (
                                <>
                                  <UserCheck className="w-4 h-4 text-primary" />
                                  <span>Active Self Session</span>
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-4 h-4 text-error" />
                                  <span>Restricted Access</span>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default TeamPage;
