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

export interface UpdateFilterPresetValues {
	id: string;
	name?: string;
	payload?: FilterPresetPayload;
}

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
			trpcClient.filterPreset.create.mutate({
				screenKey,
				...values,
			} as Parameters<typeof trpcClient.filterPreset.create.mutate>[0]),
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

	const updateMutation = useMutation({
		mutationFn: (values: UpdateFilterPresetValues) =>
			trpcClient.filterPreset.update.mutate(values),
		onMutate: async (values) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<FilterPresetItem>(queryClient, listKey, (old) =>
				old.map((p) =>
					p.id === values.id
						? {
								...p,
								...(values.name === undefined ? {} : { name: values.name }),
								...(values.payload === undefined
									? {}
									: { payload: values.payload }),
								updatedAt: new Date().toISOString(),
							}
						: p
				)
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
		isSuccess: listQuery.isSuccess,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
		isSetDefaultPending: setDefaultMutation.isPending,
		isClearDefaultPending: clearDefaultMutation.isPending,
		create: (values: CreateFilterPresetValues) =>
			createMutation.mutateAsync(values),
		update: (values: UpdateFilterPresetValues) =>
			updateMutation.mutateAsync(values),
		remove: (id: string) => deleteMutation.mutateAsync(id),
		setDefault: (id: string) => setDefaultMutation.mutateAsync(id),
		clearDefault: (id: string) => clearDefaultMutation.mutateAsync(id),
	};
}
