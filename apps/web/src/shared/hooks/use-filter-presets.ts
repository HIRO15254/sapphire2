import type {
	FilterPresetPayload,
	FilterPresetScreenKey,
} from "@sapphire2/db/schemas/filter-preset";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	createOptimisticId,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export type { FilterPresetScreenKey } from "@sapphire2/db/schemas/filter-preset";

export interface FilterPresetItem {
	createdAt: Date | string;
	id: string;
	isDefault: boolean;
	name: string;
	payload: FilterPresetPayload;
	screenKey: FilterPresetScreenKey;
	updatedAt: Date | string;
	userId: string;
}

export interface CreateFilterPresetValues {
	name: string;
	payload: FilterPresetPayload;
}

/**
 * Screen-agnostic filter-preset hook wrapping the `filterPreset` tRPC
 * router. Call `useFilterPresets("sessions")` / `useFilterPresets("statistics")`
 * from any screen — the cache is scoped per screenKey via the query key, so
 * two instances with different screenKey arguments never share state.
 */
export function useFilterPresets(screenKey: FilterPresetScreenKey) {
	const queryClient = useQueryClient();
	const listKey = trpc.filterPreset.list.queryOptions({ screenKey }).queryKey;

	const listQuery = useQuery(
		trpc.filterPreset.list.queryOptions({ screenKey })
	);
	const presets = (listQuery.data ?? []) as FilterPresetItem[];
	const defaultPreset = presets.find((p) => p.isDefault) ?? null;

	const createMutation = useMutation({
		mutationFn: (values: CreateFilterPresetValues) =>
			trpcClient.filterPreset.create.mutate(
				// screenKey is only known at hook-instantiation time (not a compile-
				// time literal here), so it can't narrow the discriminated union the
				// procedure expects; the server re-validates the payload against
				// this exact screenKey regardless.
				{ screenKey, ...values } as Parameters<
					typeof trpcClient.filterPreset.create.mutate
				>[0]
			),
		onMutate: async (values) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<FilterPresetItem>(queryClient, listKey, (old) => [
				...old,
				{
					id: createOptimisticId("temp"),
					userId: "",
					screenKey,
					name: values.name,
					payload: values.payload,
					isDefault: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			]);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.filterPreset.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<FilterPresetItem>(queryClient, listKey, (old) =>
				old.filter((p) => p.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const setDefaultMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.filterPreset.setDefault.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			// Mirrors the server: the target flips to true, every other row in
			// this SAME (screenKey-scoped) cache entry flips to false.
			updateQueryItems<FilterPresetItem>(queryClient, listKey, (old) =>
				old.map((p) => ({ ...p, isDefault: p.id === id }))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const clearDefaultMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.filterPreset.clearDefault.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<FilterPresetItem>(queryClient, listKey, (old) =>
				old.map((p) => (p.id === id ? { ...p, isDefault: false } : p))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	return {
		presets,
		defaultPreset,
		isLoading: listQuery.isLoading,
		isCreatePending: createMutation.isPending,
		isDeletePending: deleteMutation.isPending,
		isSetDefaultPending: setDefaultMutation.isPending,
		create: (values: CreateFilterPresetValues) =>
			createMutation.mutateAsync(values),
		remove: (id: string) => deleteMutation.mutateAsync(id),
		setDefault: (id: string) => setDefaultMutation.mutateAsync(id),
		clearDefault: (id: string) => clearDefaultMutation.mutateAsync(id),
	};
}
