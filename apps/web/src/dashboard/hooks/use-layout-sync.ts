import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { trpc, trpcClient } from "@/utils/trpc";
import type { Device } from "./use-current-device";
import type { DashboardWidget } from "./use-dashboard-widgets";

const LAYOUT_DEBOUNCE_MS = 500;

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
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const mutation = useMutation({
		mutationFn: (items: LayoutItem[]) =>
			trpcClient.dashboardWidget.updateLayouts.mutate({ device, items }),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
		},
	});

	const flush = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (pendingRef.current.size === 0) {
			return;
		}
		const items = Array.from(pendingRef.current.values());
		pendingRef.current.clear();
		mutation.mutate(items);
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
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			timerRef.current = setTimeout(flush, LAYOUT_DEBOUNCE_MS);
		},
		[queryClient, listKey, flush]
	);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, []);

	return { enqueue, flush, isSyncing: mutation.isPending };
}
