import React from 'react';
import { useThemeStore } from '@/shared/stores/themeStore';
import { Toaster as Sonner } from 'sonner';

export function Toaster({ ...props }) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const theme = isDarkMode ? 'dark' : 'light';

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:bg-base-200 group-[.toaster]:text-base-content group-[.toaster]:border-base-content/10 group-[.toaster]:shadow-lg font-sans rounded-xl backdrop-blur-md",
          description: "text-base-content/60",
          actionButton:
            "bg-primary text-primary-content",
          cancelButton:
            "bg-base-300 text-base-content/60",
        },
      }}
      {...props}
    />
  );
}

export default Toaster;
