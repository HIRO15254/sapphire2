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
			createElement(Toast, { variant: "destructive", title: error.message }),
		{
			duration: 6000,
			unstyled: true,
			classNames: {
				toast: "!border-0 !bg-transparent !p-0 !shadow-[none]",
				content: "!w-full",
			},
		}
	);
	queryClient.invalidateQueries();
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
