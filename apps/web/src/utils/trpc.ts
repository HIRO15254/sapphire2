import type { AppRouter } from "@sapphire2/api/routers/index";

import { env } from "@sapphire2/env/web";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { del, get, set } from "idb-keyval";
import { toast } from "sonner";

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(error.message, {
				action: {
					label: "retry",
					onClick: query.invalidate,
				},
			});
		},
	}),
	mutationCache: new MutationCache({
		onError: (error) => {
			toast.error(error.message);
		},
	}),
	defaultOptions: {
		queries: {
			gcTime: 1000 * 60 * 60 * 24,
			staleTime: 0,
			networkMode: "offlineFirst",
		},
		mutations: {
			networkMode: "offlineFirst",
		},
	},
});

export const persister = createAsyncStoragePersister({
	storage: {
		getItem: (key) => get(key),
		setItem: (key, value) => set(key, value),
		removeItem: (key) => del(key),
	},
	key: "sapphire2-query-cache",
});

/**
 * Wipe every trace of the signed-in user's data on sign-out.
 *
 * The whole tRPC query cache is persisted to IndexedDB keyed only by procedure
 * name (not per-user), so on a shared device the next account would briefly see
 * the previous user's financial data (SA2-159). Clearing the in-memory cache
 * (`queryClient.clear()`) removes what is currently rendered, and
 * `persister.removeClient()` deletes the persisted `sapphire2-query-cache` store
 * so nothing can be rehydrated on the next load.
 */
export function clearPersistedQueryCache(): Promise<void> {
	queryClient.clear();
	return Promise.resolve(persister.removeClient());
}

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${env.VITE_SERVER_URL}/trpc`,
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include",
				});
			},
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
