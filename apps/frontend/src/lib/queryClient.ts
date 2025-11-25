import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds - tuned for counts
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
