import type { AppRouter } from "@sapphire2/api/routers/index";

import { env } from "@sapphire2/env/web";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { del, get, set } from "idb-keyval";
import { createElement } from "react";
import { toast } from "sonner";
import { Toast } from "@/shared/components/ui/sonner";
import { isConcurrentChange } from "@/shared/lib/query-failure";

export const queryClient = new QueryClient({
	defaultOptions: {
		mutations: {
			networkMode: "offlineFirst",
		},
		queries: {
			gcTime: 1000 * 60 * 60 * 24,
			networkMode: "offlineFirst",
			staleTime: 0,
		},
	},
});

queryClient.getMutationCache().subscribe((event) => {
	if (event.type !== "updated" || event.action.type !== "error") {
		return;
	}
	const error = event.action.error;
	if (!isConcurrentChange(error)) {
		return;
	}
	toast.custom(
		() =>
			createElement(Toast, { title: error.message, variant: "destructive" }),
		{
			classNames: {
				content: "!w-full",
				toast: "!border-0 !bg-transparent !p-0 !shadow-[none]",
			},
			duration: 6000,
			unstyled: true,
		}
	);
	queryClient.invalidateQueries();
});

export const persister = createAsyncStoragePersister({
	key: "sapphire2-query-cache",
	storage: {
		getItem: (key) => get(key),
		removeItem: (key) => del(key),
		setItem: (key, value) => set(key, value),
	},
});

export function clearPersistedQueryCache(): Promise<void> {
	queryClient.clear();
	return Promise.resolve(persister.removeClient());
}

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include",
				});
			},
			url: `${env.VITE_SERVER_URL}/trpc`,
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
