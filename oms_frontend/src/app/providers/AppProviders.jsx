import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import { Toaster } from 'sonner';

// Configure global QueryClient settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {children}
          {/* Sonner toast provider configured for rich styling */}
          <Toaster 
            richColors 
            position="top-right" 
            theme="dark" 
            closeButton 
            toastOptions={{
              className: 'font-sans rounded-xl border-base-content/10 shadow-xl backdrop-blur-md bg-base-200/95',
            }}
          />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
