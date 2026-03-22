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
			staleTime: 1000 * 60 * 5,
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
