import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pettyCashApi } from '../api/pettyCashApi';
import { SearchInput } from '@/shared/components/ui/SearchInput';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { useGSAPStagger } from '@/shared/hooks/useGSAPStagger';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import gsap from 'gsap';
import { 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Trash2, 
  UploadCloud, 
  FileText, 
  AlertTriangle,
  X,
  ArrowLeft,
  ChevronRight,
  TrendingDown,
  Info,
  Calendar,
  DollarSign
} from 'lucide-react';

// Form validation schema with Zod
const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().positive('Unit price must be positive'),
  category: z.string().min(1, 'Category is required'),
});

const requisitionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  needed_by: z.string().min(1, 'Needed date is required'),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
});

const LINE_ITEM_CATEGORIES = [
  'Office Supplies',
  'Travel & Lodging',
  'Equipment & Assets',
  'Food & Beverage',
  'Utilities & Software',
  'Repairs & Maintenance',
  'Others'
];

export function PettyCashListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-driven tabs and pagination
  const activeTab = searchParams.get('state') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const searchVal = searchParams.get('search') || '';
  const priorityVal = searchParams.get('priority') || 'all';

  // Toggle view state: 'list' or 'create'
  const [view, setView] = useState(searchParams.get('create') === 'true' ? 'create' : 'list');
  const [filesToUpload, setFilesToUpload] = useState([]);
  
  // Filter drawer state for mobile
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Fetch Petty Cash requests
  const filterParams = { page };
  if (activeTab !== 'all') filterParams.state = activeTab;
  if (priorityVal !== 'all') filterParams.priority = priorityVal;
  if (searchVal) filterParams.search = searchVal;

  const { data: requisitions, isLoading, isError } = useQuery({
    queryKey: ['petty-cash-list', filterParams],
    queryFn: () => pettyCashApi.list(filterParams),
  });

  // Department Budget Info
  const deptBudget = parseFloat(user?.profile?.department?.monthly_budget || 0);
  const deptSpent = parseFloat(user?.profile?.department?.budget_spent_this_month || 0);
  const remainingBudget = deptBudget - deptSpent;

  // React Hook Form
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      needed_by: '',
      line_items: [{ description: '', quantity: 1, unit_price: 0, category: 'Office Supplies' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  // Watch fields for calculations
  const watchedLineItems = watch('line_items');
  const totalAmountRequested = watchedLineItems?.reduce((sum, item) => {
    const qty = parseInt(item?.quantity) || 0;
    const price = parseFloat(item?.unit_price) || 0;
    return sum + (qty * price);
  }, 0) || 0;

  // Budget validation check
  const isOverBudget = totalAmountRequested > remainingBudget;

  // Mutation: Create request
  const createMutation = useMutation({
    mutationFn: (data) => pettyCashApi.create(data),
    onSuccess: async (newReq) => {
      // If we have attachments, upload them
      if (filesToUpload.length > 0) {
        toast.info('Uploading attachments...');
        try {
          await pettyCashApi.uploadAttachments(newReq.uuid, filesToUpload);
          toast.success('Attachments uploaded.');
        } catch (e) {
          toast.error('Failed to upload some attachments.');
        }
      }
      
      // Auto-submit requisition right after creation
      try {
        await pettyCashApi.submit(newReq.uuid);
        toast.success('Requisition submitted for approval!');
      } catch (submitErr) {
        toast.warning('Requisition created as draft. Please submit it manually.');
      }

      // Reset states
      reset();
      setFilesToUpload([]);
      setView('list');
      setSearchParams(prev => {
        prev.delete('create');
        return prev;
      });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-petty-cash'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to create requisition.';
      toast.error(msg);
    }
  });

  // Stagger items entrance
  const listRef = useGSAPStagger('.requisition-card', [requisitions?.results]);

  const handleTabChange = (state) => {
    setSearchParams((prev) => {
      if (state === 'all') prev.delete('state');
      else prev.set('state', state);
      prev.set('page', '1');
      return prev;
    });
  };

  const handleSearch = (term) => {
    setSearchParams((prev) => {
      if (!term) prev.delete('search');
      else prev.set('search', term);
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePriorityFilter = (priority) => {
    setSearchParams((prev) => {
      if (priority === 'all') prev.delete('priority');
      else prev.set('priority', priority);
      prev.set('page', '1');
      return prev;
    });
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer?.files || e.target.files);
    
    // Validations
    const validFiles = droppedFiles.filter(file => {
      const isValidSize = file.size <= 10 * 1024 * 1024;
      const isValidType = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      
      if (!isValidSize) toast.error(`${file.name} exceeds 10MB limit.`);
      if (!isValidType) toast.error(`${file.name} file type is not supported.`);
      
      return isValidSize && isValidType;
    });

    if (filesToUpload.length + validFiles.length > 5) {
      toast.error('You can upload a maximum of 5 files.');
      return;
    }

    setFilesToUpload(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data) => {
    if (isOverBudget) {
      toast.error('Requisition exceeds your department\'s remaining budget.');
      return;
    }

    // Format fields correctly
    const payload = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      needed_by: data.needed_by,
      amount_requested: totalAmountRequested,
      department_id: user?.profile?.department?.id,
      line_items: data.line_items.map(item => ({
        description: item.description,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(item.unit_price),
        category: item.category
      }))
    };

    createMutation.mutate(payload);
  };

  const handleCreateToggle = (shouldCreate) => {
    if (shouldCreate) {
      setView('create');
      setSearchParams(prev => {
        prev.set('create', 'true');
        return prev;
      });
    } else {
      setView('list');
      setSearchParams(prev => {
        prev.delete('create');
        return prev;
      });
      reset();
      setFilesToUpload([]);
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

          {view === 'list' && (
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
                <select
                  value={priorityVal}
                  onChange={(e) => handlePriorityFilter(e.target.value)}
                  className="select select-bordered rounded-xl bg-base-100/40 border-base-content/10 text-xs font-semibold focus:bg-base-100"
                >
                  <option value="all">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>

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
              {['all', 'draft', 'pending_tl_approval', 'pending_ceo_approval', 'approved', 'partially_disbursed', 'disbursed', 'rejected', 'cancelled'].map((tab) => {
                const label = tab === 'all' 
                  ? 'All' 
                  : tab === 'pending_tl_approval'
                  ? 'Lead Approval'
                  : tab === 'pending_ceo_approval'
                  ? 'CEO Approval'
                  : tab.charAt(0).toUpperCase() + tab.slice(1).replace('_', ' ');
                
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
                    className="requisition-card glass-panel rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-base-content/5 flex flex-col justify-between h-56 group relative overflow-hidden"
                  >
                    {/* Glowing card border gradient on hover */}
                    <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                    <div className="space-y-3 relative z-10">
                      <div className="flex justify-between items-start gap-2">
                        <StatusBadge state={req.state} />
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          req.priority === 'URGENT' 
                            ? 'bg-error/15 text-error' 
                            : req.priority === 'HIGH'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-base-300 text-base-content/60'
                        }`}>
                          {req.priority}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <Link to={`/petty-cash/${req.uuid}`} className="text-base font-extrabold text-base-content hover:text-primary transition-colors truncate block Outfit">
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

                      <Link 
                        to={`/petty-cash/${req.uuid}`}
                        className="btn btn-ghost btn-circle btn-sm text-base-content/55 hover:bg-base-content/5 hover:text-primary transition-all group-hover:translate-x-1"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No requisitions found" 
                message="Adjust your search filters or create a new petty cash requisition to get started."
                actionLabel="Raise Requisition"
                onAction={() => handleCreateToggle(true)}
              />
            )}

            {/* Pagination */}
            {requisitions?.count > 20 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setSearchParams(prev => { prev.set('page', String(page - 1)); return prev; })}
                  className="btn btn-outline btn-sm rounded-lg border-base-content/10 text-xs"
                >
                  Previous
                </button>
                <span className="self-center text-xs font-semibold text-base-content/60 px-4">
                  Page {page} of {Math.ceil(requisitions.count / 20)}
                </span>
                <button
                  disabled={page >= Math.ceil(requisitions.count / 20)}
                  onClick={() => setSearchParams(prev => { prev.set('page', String(page + 1)); return prev; })}
                  className="btn btn-outline btn-sm rounded-lg border-base-content/10 text-xs"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* CREATE REQUISITION VIEW */}
        {view === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Fields */}
            <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5">
                <h3 className="text-lg font-bold Outfit border-b border-base-content/5 pb-3">Requisition Details</h3>

                <div className="space-y-4">
                  <div>
                    <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Title</label>
                    <input
                      type="text"
                      className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm ${
                        errors.title ? 'input-error' : ''
                      }`}
                      placeholder="e.g. Office Stationery and Printer Toner"
                      {...register('title')}
                    />
                    {errors.title && <span className="text-xs text-error font-medium mt-1 block">{errors.title.message}</span>}
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Description</label>
                    <textarea
                      rows={3}
                      className={`textarea textarea-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm ${
                        errors.description ? 'textarea-error' : ''
                      }`}
                      placeholder="Explain what these purchases will cover, and what department/task they support."
                      {...register('description')}
                    />
                    {errors.description && <span className="text-xs text-error font-medium mt-1 block">{errors.description.message}</span>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Priority</label>
                      <select
                        className="select select-bordered w-full rounded-xl bg-base-100/40 border-base-content/10 text-sm focus:bg-base-100"
                        {...register('priority')}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs font-bold text-base-content/75 uppercase tracking-wider">Needed By Date</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className={`input input-bordered w-full rounded-xl bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm ${
                          errors.needed_by ? 'input-error' : ''
                        }`}
                        {...register('needed_by')}
                      />
                      {errors.needed_by && <span className="text-xs text-error font-medium mt-1 block">{errors.needed_by.message}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Line Items Editor */}
              <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5">
                <div className="flex justify-between items-center border-b border-base-content/5 pb-3">
                  <h3 className="text-lg font-bold Outfit">Itemized Expenditures</h3>
                  <button
                    type="button"
                    onClick={() => append({ description: '', quantity: 1, unit_price: 0, category: 'Office Supplies' })}
                    className="btn btn-ghost btn-xs text-primary font-bold gap-1 rounded-md"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {fields.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-base-300/30 p-4 rounded-xl border border-base-content/5 relative group"
                    >
                      <div className="md:col-span-4">
                        <label className="label text-[10px] font-bold text-base-content/65 uppercase py-1">Description</label>
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full rounded-lg bg-base-100/50 border-base-content/10 text-xs"
                          placeholder="e.g. A4 size papers"
                          {...register(`line_items.${index}.description`)}
                        />
                        {errors.line_items?.[index]?.description && (
                          <span className="text-[10px] text-error mt-0.5 block">{errors.line_items[index].description.message}</span>
                        )}
                      </div>

                      <div className="md:col-span-3">
                        <label className="label text-[10px] font-bold text-base-content/65 uppercase py-1">Category</label>
                        <select
                          className="select select-bordered select-sm w-full rounded-lg bg-base-100/50 border-base-content/10 text-xs focus:bg-base-100"
                          {...register(`line_items.${index}.category`)}
                        >
                          {LINE_ITEM_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="label text-[10px] font-bold text-base-content/65 uppercase py-1">Qty</label>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-full rounded-lg bg-base-100/50 border-base-content/10 text-xs"
                          {...register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                        />
                        {errors.line_items?.[index]?.quantity && (
                          <span className="text-[10px] text-error mt-0.5 block">{errors.line_items[index].quantity.message}</span>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="label text-[10px] font-bold text-base-content/65 uppercase py-1">Unit Price (৳)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input input-bordered input-sm w-full rounded-lg bg-base-100/50 border-base-content/10 text-xs"
                          {...register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
                        />
                        {errors.line_items?.[index]?.unit_price && (
                          <span className="text-[10px] text-error mt-0.5 block">{errors.line_items[index].unit_price.message}</span>
                        )}
                      </div>

                      <div className="md:col-span-1 flex justify-center pb-1">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {errors.line_items?.root && (
                    <span className="text-xs text-error block">{errors.line_items.root.message}</span>
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleCreateToggle(false)}
                  className="btn btn-ghost rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending || isOverBudget}
                  className="btn btn-primary rounded-xl font-bold px-8 shadow-lg shadow-primary/20 text-xs"
                >
                  {createMutation.isPending ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    'Submit Requisition'
                  )}
                </button>
              </div>
            </form>

            {/* Right Side: Budget Indicator & Attachments */}
            <div className="space-y-6">
              {/* Budget Monitor Widget */}
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-base font-bold Outfit flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-primary" />
                  Budget Monitor
                </h3>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-base-content/60">Department Budget</span>
                      <span>৳{deptBudget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-base-content/60">Remaining Budget</span>
                      <span className="text-success font-bold">৳{remainingBudget.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-base-content/5 pt-3 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-base-content/70">Voucher Total</span>
                      <span className={`text-base font-extrabold ${isOverBudget ? 'text-error' : 'text-primary'}`}>
                        ৳{totalAmountRequested.toLocaleString()}
                      </span>
                    </div>

                    <progress
                      className={`progress w-full h-2 rounded-full ${
                        isOverBudget 
                          ? 'progress-error' 
                          : totalAmountRequested / remainingBudget > 0.8
                          ? 'progress-warning'
                          : 'progress-primary'
                      }`}
                      value={totalAmountRequested}
                      max={remainingBudget > 0 ? remainingBudget : 1}
                    ></progress>

                    {isOverBudget && (
                      <div className="alert alert-error rounded-xl p-3 flex items-start gap-2 text-xs">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Requisition exceeds the remaining department budget. Contact your lead.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Uploader */}
              <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold Outfit">Receipt Attachments</h3>
                  <p className="text-[10px] text-base-content/40 font-semibold uppercase mt-0.5">Max 5 files (PDF/JPG/PNG/WEBP)</p>
                </div>

                {/* Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="border border-dashed border-base-content/20 hover:border-primary/40 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-base-100/20 hover:bg-primary/5 transition-all duration-200"
                >
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileDrop}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                    <UploadCloud className="w-8 h-8 text-base-content/30 mb-2" />
                    <span className="text-xs font-bold text-primary">Upload receipts</span>
                    <span className="text-[10px] text-base-content/40 mt-1">or drag and drop here</span>
                  </label>
                </div>

                {/* Selected files list */}
                {filesToUpload.length > 0 && (
                  <div className="space-y-2 border-t border-base-content/5 pt-3">
                    <p className="text-[10px] font-bold text-base-content/40 uppercase">Selected Files ({filesToUpload.length})</p>
                    {filesToUpload.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-base-300/40 p-2.5 rounded-lg border border-base-content/5 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold truncate max-w-[150px]">{file.name}</span>
                          <span className="text-[9px] text-base-content/40">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="btn btn-ghost btn-circle btn-xs text-base-content/45 hover:text-error"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default PettyCashListPage;
