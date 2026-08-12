import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Data is considered "fresh" for 5 minutes without needing a background refetch
			staleTime: 5 * 60 * 1000, 
			// Keeps the data in the cache for 30 minutes even if the tab/component is unmounted
			// (Use cacheTime instead of gcTime if you are on React Query v4 or older)
			gcTime: 30 * 60 * 1000, 
		},
	},
});