import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";
import type { Device } from "./use-current-device";
import type { DashboardWidget } from "./use-dashboard-widgets";

export interface LayoutItem {
	h: number;
	id: string;
	w: number;
	x: number;
	y: number;
}

export function useLayoutSync(device: Device) {
	const queryClient = useQueryClient();
	const listKey = trpc.dashboardWidget.list.queryOptions({ device }).queryKey;
	const pendingRef = useRef<Map<string, LayoutItem>>(new Map());
	const [hasPendingChanges, setHasPendingChanges] = useState(false);

	const mutation = useMutation({
		mutationFn: (items: LayoutItem[]) =>
			trpcClient.dashboardWidget.updateLayouts.mutate({ device, items }),
		onError: async () => {
			await invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const flush = useCallback(async () => {
		if (pendingRef.current.size === 0) {
			return;
		}
		const items = Array.from(pendingRef.current.values());
		pendingRef.current.clear();
		setHasPendingChanges(false);
		await mutation.mutateAsync(items);
	}, [mutation]);

	const enqueue = useCallback(
		(items: LayoutItem[]) => {
			queryClient.setQueryData<DashboardWidget[]>(listKey, (prev) => {
				if (!prev) {
					return prev;
				}
				const lookup = new Map(items.map((i) => [i.id, i]));
				return prev.map((w) => {
					const updated = lookup.get(w.id);
					return updated ? { ...w, ...updated } : w;
				});
			});

			for (const item of items) {
				pendingRef.current.set(item.id, item);
			}
			setHasPendingChanges(true);
		},
		[queryClient, listKey]
	);

	const discard = useCallback(() => {
		pendingRef.current.clear();
		setHasPendingChanges(false);
		invalidateTargets(queryClient, [{ queryKey: listKey }]);
	}, [queryClient, listKey]);

	return {
		enqueue,
		flush,
		discard,
		hasPendingChanges,
		isSyncing: mutation.isPending,
	};
}
