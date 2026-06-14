import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function Select({ value, onChange, options = [], placeholder = 'Select an option', disabled = false, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (val) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", isOpen && "z-30", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-base-content/15 bg-base-100/50 px-4 py-2.5 text-sm text-base-content shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-base-100"
      >
        <span className={cn("truncate", !selectedOption && "text-base-content/40")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-200", isOpen && "transform rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-base-content/10 bg-base-200 p-1 text-base-content shadow-lg ring-1 ring-black/5 focus:outline-none backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-100">
          {options.length === 0 ? (
            <div className="relative cursor-default select-none px-4 py-2.5 text-xs text-base-content/40">
              No options available
            </div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center justify-between rounded-lg py-2.5 pl-4 pr-10 text-sm outline-none transition-colors hover:bg-base-content/5",
                    isSelected && "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                  )}
                >
                  <span className="block truncate">{option.label}</span>
                  {isSelected && (
                    <span className="absolute inset-y-0 right-3 flex items-center pr-1 text-primary">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default Select;
