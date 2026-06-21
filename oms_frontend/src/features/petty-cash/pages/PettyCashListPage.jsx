import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  SlidersHorizontal, 
  AlertTriangle,
  X,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { SearchInput } from '@/shared/components/ui/SearchInput';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { Select } from '@/shared/components/ui/Select';
import { Badge } from '@/components/ui/badge';
import { pettyCashApi } from '../api/pettyCashApi';
import { PettyCashCreateModal } from '../components/PettyCashCreateModal';

export function PettyCashListPage() {
  const { user } = useAuth();
  const isCEO = user?.profile?.role === 'CEO';
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-driven tabs and pagination
  const activeTab = searchParams.get('state') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const searchVal = searchParams.get('search') || '';
  const priorityVal = searchParams.get('priority') || 'all';

  // Toggle view state: 'list' or 'create'
  const [view, setView] = useState(searchParams.get('create') === 'true' && !isCEO ? 'create' : 'list');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [setSelectedReq, setSelectedReqState] = useState(null);

  // Fetch Petty Cash requests
  const filterParams = { page };
  if (activeTab !== 'all') filterParams.state = activeTab;
  if (priorityVal !== 'all') filterParams.priority = priorityVal;
  if (searchVal) filterParams.search = searchVal;

  const { data: requisitions, isLoading, isError } = useQuery({
    queryKey: ['petty-cash-list', filterParams],
    queryFn: () => pettyCashApi.list(filterParams),
  });

  // Stagger items entrance
  const listRef = useGSAPStagger('.requisition-card', [requisitions?.results]);

  const handleTabChange = useCallback((state) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (state === 'all') next.delete('state');
      else next.set('state', state);
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const handleSearch = useCallback((term) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!term) next.delete('search');
      else next.set('search', term);
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const handlePriorityFilter = useCallback((priority) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (priority === 'all') next.delete('priority');
      else next.set('priority', priority);
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const handleCreateToggle = (shouldCreate) => {
    if (shouldCreate && isCEO) return;
    if (shouldCreate) {
      setView('create');
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('create', 'true');
        return next;
      });
    } else {
      setView('list');
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      });
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-content/5 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {view === 'create' && (
                <button 
                  onClick={() => handleCreateToggle(false)} 
                  className="btn btn-ghost btn-circle btn-sm mr-1 text-base-content"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-3xl font-extrabold Outfit tracking-tight">
                {view === 'create' ? 'Raise Requisition' : 'Petty Cash Requisitions'}
              </h2>
            </div>
            <p className="text-sm text-base-content/55">
              {view === 'create' 
                ? 'Create a new itemized petty cash voucher and attach receipts.' 
                : 'Track, manage, and submit department business expense requests.'}
            </p>
          </div>

          {view === 'list' && !isCEO && (
            <button 
              onClick={() => handleCreateToggle(true)}
              className="btn btn-primary rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              Raise Requisition
            </button>
          )}
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              {/* Search Bar */}
              <SearchInput 
                value={searchVal}
                onSearch={handleSearch} 
                placeholder="Search requisitions (e.g. office ink)..."
              />

              {/* Priority & Filters */}
              <div className="flex gap-3">
                <Select
                  value={priorityVal}
                  onChange={handlePriorityFilter}
                  options={[
                    { value: 'all', label: 'All Priorities' },
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'URGENT', label: 'Urgent' },
                  ]}
                  className="w-40"
                />

                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="btn btn-outline border-base-content/10 hover:border-primary hover:bg-primary/5 hover:text-primary rounded-xl font-bold gap-2 text-xs flex lg:hidden"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </button>
              </div>
            </div>

            {/* Workflow status tabs */}
            <div className="tabs tabs-box bg-base-200/50 p-1 rounded-xl max-w-fit border border-base-content/5 flex-wrap gap-1">
              {['all', 'draft', 'pending_tl_approval', 'pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed', 'disbursed', 'rejected', 'rejected_by_ceo', 'cancelled'].map((tab) => {
                const label = tab === 'all' 
                  ? 'All' 
                  : tab === 'pending_tl_approval'
                  ? 'Lead Approval'
                  : tab === 'pending_ceo_approval'
                  ? 'CEO Approval'
                  : tab === 'pending_hr_disbursement'
                  ? 'Pending Disbursement'
                  : tab === 'rejected_by_ceo'
                  ? 'CEO Rejected'
                  : tab.charAt(0).toUpperCase() + tab.slice(1).replace(/_/g, ' ');
                
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`tab rounded-lg text-xs font-semibold px-4 py-2 ${
                      activeTab === tab 
                        ? 'tab-active bg-primary text-primary-content shadow font-bold' 
                        : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Requisitions Grid */}
            {isLoading ? (
              <LoadingSkeleton variant="card" count={3} />
            ) : isError ? (
              <div className="alert alert-error rounded-2xl flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 mt-0.5 text-error-content" />
                <div>
                  <h4 className="font-bold text-sm">Failed to load requisitions</h4>
                  <p className="text-xs text-error-content/80 mt-1">Please check your internet connection or verify authentication.</p>
                </div>
              </div>
            ) : requisitions?.results?.length > 0 ? (
              <div ref={listRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {requisitions.results.map((req) => (
                  <div 
                    key={req.id} 
                    onClick={() => setSelectedReqState(req)}
                    className="requisition-card glass-panel rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-0.5 cursor-pointer transition-all duration-300 border border-base-content/5 flex flex-col justify-between h-56 group relative overflow-hidden"
                  >
                    {/* Glowing card border gradient on hover */}
                    <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                    <div className="space-y-3 relative z-10">
                      <div className="flex justify-between items-start gap-2">
                        <StatusBadge state={req.state} />
                        <Badge 
                          variant={
                            req.priority === 'URGENT' || req.priority === 'HIGH'
                              ? 'destructive' 
                              : req.priority === 'MEDIUM'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="font-bold text-[10px] px-2 py-0.5 rounded"
                        >
                          {req.priority}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <Link 
                          to={`/petty-cash/${req.uuid}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-base font-extrabold text-base-content hover:text-primary transition-colors truncate block Outfit"
                        >
                          {req.title}
                        </Link>
                        <p className="text-xs text-base-content/50 line-clamp-2 leading-relaxed">
                          {req.description}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-base-content/5 pt-4 flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">Amount Requested</p>
                        <h4 className="text-lg font-black Outfit text-primary">
                          ৳{parseFloat(req.amount_requested).toLocaleString()}
                        </h4>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] uppercase font-black text-base-content/40 tracking-widest">Needed By</p>
                        <p className="text-xs font-semibold text-base-content/75 mt-0.5">
                          {new Date(req.needed_by).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Requisitions Found"
                message="Raise a new requisition using the action above to request petty cash."
                actionLabel="Raise Requisition"
                onAction={() => handleCreateToggle(true)}
              />
            )}
          </div>
        )}

        {/* CREATE REQUISITION VIEW */}
        {view === 'create' && (
          <PettyCashCreateModal user={user} onClose={() => handleCreateToggle(false)} />
        )}
      </div>

      {/* Requisition Details Slide-over Drawer */}
      {setSelectedReq && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedReqState(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-md bg-base-200/98 backdrop-blur-md shadow-2xl h-full border-l border-base-content/5 flex flex-col z-10 animate-slide-in-right glass-panel p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-base-content/5 pb-4">
              <div>
                <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Requisition Peek</span>
                <h3 className="text-lg font-bold Outfit text-base-content mt-0.5">#{setSelectedReq.id} Details</h3>
              </div>
              <button 
                onClick={() => setSelectedReqState(null)}
                className="btn btn-ghost btn-circle btn-sm hover:bg-base-content/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <StatusBadge state={setSelectedReq.state} />
              </div>

              <div>
                <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide">Title</h4>
                <p className="text-base font-extrabold text-base-content Outfit mt-1">{setSelectedReq.title}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide">Description</h4>
                <p className="text-xs text-base-content/75 mt-1 leading-relaxed whitespace-pre-wrap">{setSelectedReq.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-b border-base-content/5 py-4">
                <div>
                  <h4 className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Priority</h4>
                  <Badge 
                    variant={
                      setSelectedReq.priority === 'URGENT' || setSelectedReq.priority === 'HIGH'
                        ? 'destructive' 
                        : setSelectedReq.priority === 'MEDIUM'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="font-bold text-[10px] px-2 py-0.5 rounded mt-1"
                  >
                    {setSelectedReq.priority}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Needed By</h4>
                  <p className="text-xs text-base-content font-semibold mt-1">
                    {new Date(setSelectedReq.needed_by).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide">Amount Requested</h4>
                <h3 className="text-2xl font-black Outfit text-primary mt-1">
                  ৳{parseFloat(setSelectedReq.amount_requested).toLocaleString()}
                </h3>
              </div>
            </div>

            <div className="pt-6 border-t border-base-content/5 flex gap-3">
              <Link 
                to={`/petty-cash/${setSelectedReq.uuid}`}
                onClick={() => setSelectedReqState(null)}
                className="btn btn-primary rounded-xl font-bold flex-1 text-xs shadow-md shadow-primary/25"
              >
                View Full Details Page
              </Link>
              <button 
                onClick={() => setSelectedReqState(null)}
                className="btn btn-outline border-base-content/10 hover:bg-base-content/5 rounded-xl text-xs"
              >
                Close Peek
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageTransition>
  );
}

export default PettyCashListPage;
