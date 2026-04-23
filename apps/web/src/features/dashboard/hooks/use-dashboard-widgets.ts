import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";
import type { Device } from "./use-current-device";

export type WidgetType =
	| "summary_stats"
	| "recent_sessions"
	| "active_session"
	| "currency_balance";

export interface DashboardWidget {
	config: Record<string, unknown>;
	createdAt: string;
	device: Device;
	h: number;
	id: string;
	type: WidgetType;
	updatedAt: string;
	userId: string;
	w: number;
	x: number;
	y: number;
}

export interface CreateWidgetInput {
	config?: Record<string, unknown>;
	type: WidgetType;
}

export function useDashboardWidgets(device: Device) {
	const queryClient = useQueryClient();
	const listKey = trpc.dashboardWidget.list.queryOptions({ device }).queryKey;

	const widgetsQuery = useQuery(
		trpc.dashboardWidget.list.queryOptions({ device })
	);

	const invalidateList = useCallback(() => {
		return invalidateTargets(queryClient, [{ queryKey: listKey }]);
	}, [queryClient, listKey]);

	const createMutation = useMutation({
		mutationFn: (input: CreateWidgetInput) =>
			trpcClient.dashboardWidget.create.mutate({
				device,
				type: input.type,
				config: input.config,
			}),
		onSettled: async () => {
			await invalidateList();
		},
	});

	const updateMutation = useMutation({
		mutationFn: (input: { id: string; config?: Record<string, unknown> }) =>
			trpcClient.dashboardWidget.update.mutate({
				id: input.id,
				config: input.config,
			}),
		onMutate: async (input) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery<DashboardWidget[]>(queryClient, listKey);
			queryClient.setQueryData<DashboardWidget[]>(
				listKey,
				(old) =>
					old?.map((w) =>
						w.id === input.id ? { ...w, config: input.config ?? w.config } : w
					) ?? []
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: async () => {
			await invalidateList();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.dashboardWidget.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery<DashboardWidget[]>(queryClient, listKey);
			queryClient.setQueryData<DashboardWidget[]>(
				listKey,
				(old) => old?.filter((w) => w.id !== id) ?? []
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: async () => {
			await invalidateList();
		},
	});

	return {
		widgets: (widgetsQuery.data ?? []) as DashboardWidget[],
		isLoading: widgetsQuery.isLoading,
		isFetching: widgetsQuery.isFetching,
		error: widgetsQuery.error,
		createWidget: (input: CreateWidgetInput) =>
			createMutation.mutateAsync(input),
		updateWidget: (input: { id: string; config?: Record<string, unknown> }) =>
			updateMutation.mutateAsync(input),
		deleteWidget: (id: string) => deleteMutation.mutateAsync(id),
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
}
