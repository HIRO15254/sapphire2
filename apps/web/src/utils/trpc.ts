import type { AppRouter } from "@sapphire2/api/routers/index";

import { env } from "@sapphire2/env/web";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { del, get, set } from "idb-keyval";

export const queryClient = new QueryClient({
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
