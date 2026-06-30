import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  UploadCloud, 
  FileText, 
  AlertTriangle,
  TrendingDown
} from 'lucide-react';
import { Select } from '@/shared/components/ui/Select';
import { PriceLookupPanel } from '@/shared/components/ui/PriceLookupPanel';
import { pettyCashApi } from '../api/pettyCashApi';

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

export function PettyCashCreateModal({ user, onClose }) {
  const queryClient = useQueryClient();
  const [filesToUpload, setFilesToUpload] = useState([]);

  // Department Budget Info
  const deptBudget = parseFloat(user?.profile?.department?.monthly_budget || 0);
  const deptSpent = parseFloat(user?.profile?.department?.budget_spent_this_month || 0);
  const deptCommitted = parseFloat(user?.profile?.department?.budget_committed || 0);
  const budgetFrequency = user?.profile?.department?.budget_frequency || 'MONTHLY';
  const remainingBudget = Math.max(0, deptBudget - deptSpent - deptCommitted);

  // React Hook Form
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
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
  const watchedPriority = watch('priority');
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
        } catch (_e) {
          toast.error('Failed to upload some attachments.');
        }
      }
      
      // Auto-submit requisition right after creation
      try {
        await pettyCashApi.submit(newReq.uuid);
        toast.success('Requisition submitted for approval!');
      } catch (_submitErr) {
        toast.warning('Requisition created as draft. Please submit it manually.');
      }

      // Reset states
      reset();
      setFilesToUpload([]);
      onClose();
      queryClient.invalidateQueries({ queryKey: ['petty-cash-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-petty-cash'] });
      ['pending-petty-cash', 'analytics-summary', 'analytics-spending-trends', 'analytics-burn-rate', 'dashboard-activities'].forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to create requisition.';
      toast.error(msg);
    }
  });

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left side: Requisition Details & Items */}
      <div className="lg:col-span-2 space-y-6">
        {/* Requisition Details Panel */}
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
                rows={4}
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
                <Select
                  value={watchedPriority}
                  onChange={(val) => setValue('priority', val)}
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'URGENT', label: 'Urgent' },
                  ]}
                />
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
                  <Select
                    value={watchedLineItems?.[index]?.category}
                    onChange={(val) => setValue(`line_items.${index}.category`, val)}
                    options={LINE_ITEM_CATEGORIES.map(cat => ({
                      value: cat,
                      label: cat
                    }))}
                    className="[&>button]:h-8 [&>button]:py-1 [&>button]:rounded-lg [&>button]:text-xs"
                  />
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
            onClick={onClose}
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
      </div>

      {/* Right Side Column: Budget Monitor & Receipts */}
      <div className="space-y-6">
        {/* Budget Monitor Widget */}
        {user?.profile?.role !== 'EMPLOYEE' && (
          <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-base font-bold Outfit flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary" />
              Budget Monitor
            </h3>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-base-content/60">{budgetFrequency === 'MONTHLY' ? 'Monthly' : budgetFrequency === 'QUARTERLY' ? 'Quarterly' : 'Yearly'} Budget</span>
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
        )}

        {/* Market Price Intel Panel */}
        <PriceLookupPanel />

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
              multiple
              onChange={handleFileDrop}
              className="hidden"
              id="file-upload-input"
            />
            <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center justify-center w-full">
              <UploadCloud className="w-8 h-8 text-base-content/40 mb-2" />
              <span className="text-xs font-semibold text-base-content/85">Drag files here or <span className="text-primary hover:underline">browse</span></span>
            </label>
          </div>

          {/* Uploaded Files List */}
          {filesToUpload.length > 0 && (
            <div className="space-y-2 pt-2">
              {filesToUpload.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-base-300/30 rounded-xl border border-base-content/5 text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate font-semibold text-base-content">{file.name}</span>
                    <span className="text-[9px] text-base-content/40 font-bold">({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
export default PettyCashCreateModal;
