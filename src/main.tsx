import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

// React Query client configuration - optimized for smooth polling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,           // Data stays fresh for 5 seconds
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: 1,                    // Only retry failed requests once
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
