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

export interface RoomValues {
	latitude?: number;
	longitude?: number;
	memo?: string;
	name: string;
}

export interface RoomItem {
	archivedAt?: Date | string | null;
	createdAt: Date | string;
	id: string;
	isFavorite: boolean;
	isReferenced: boolean;
	latitude?: number | null;
	longitude?: number | null;
	memo?: string | null;
	name: string;
	ringGameCount: number;
	tournamentCount: number;
}

export function useRooms({ showArchived = false } = {}) {
	const queryClient = useQueryClient();
	const roomListKey = trpc.room.list.queryOptions().queryKey;

	const roomsQuery = useQuery(trpc.room.list.queryOptions());
	const rooms = roomsQuery.data ?? [];
	const archivedListKey = trpc.room.list.queryOptions({
		includeArchived: true,
	}).queryKey;
	const archivedQuery = useQuery({
		...trpc.room.list.queryOptions({ includeArchived: true }),
		enabled: showArchived,
	});
	const invalidateRooms = () => {
		invalidateTargets(queryClient, [
			{ queryKey: roomListKey },
			{ queryKey: archivedListKey },
		]);
	};

	const createMutation = useMutation({
		mutationFn: (values: RoomValues) => trpcClient.room.create.mutate(values),
		onMutate: async (newRoom) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			updateQueryItems<RoomItem>(queryClient, roomListKey, (old) => {
				if (!old) {
					return old;
				}
				const base = old[0];
				if (!base) {
					return old;
				}
				return [
					...old,
					{
						...base,
						id: createOptimisticId("temp"),
						name: newRoom.name,
						memo: newRoom.memo ?? null,
						latitude: newRoom.latitude ?? null,
						longitude: newRoom.longitude ?? null,
						isFavorite: false,
						isReferenced: false,
						archivedAt: null,
						createdAt: new Date().toISOString(),
						ringGameCount: 0,
						tournamentCount: 0,
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: invalidateRooms,
	});

	const updateMutation = useMutation({
		mutationFn: (values: RoomValues & { id: string }) =>
			trpcClient.room.update.mutate({
				id: values.id,
				name: values.name,
				memo: values.memo ?? null,
				latitude: values.latitude ?? null,
				longitude: values.longitude ?? null,
			}),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			updateQueryItems<RoomItem>(queryClient, roomListKey, (old) =>
				old?.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: invalidateRooms,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.room.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			updateQueryItems<RoomItem>(queryClient, roomListKey, (old) =>
				old?.filter((s) => s.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: invalidateRooms,
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.room.archive.mutate({ id }),
		onSettled: invalidateRooms,
	});
	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.room.restore.mutate({ id }),
		onSettled: invalidateRooms,
	});

	const toggleFavoriteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.room.toggleFavorite.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			updateQueryItems<RoomItem>(queryClient, roomListKey, (old) => {
				if (!old) {
					return old;
				}
				const toggled = old.map((r) =>
					r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
				);
				return [...toggled].sort((a, b) => {
					if (a.isFavorite !== b.isFavorite) {
						return a.isFavorite ? -1 : 1;
					}
					return (
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				});
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: invalidateRooms,
	});

	return {
		rooms,
		archivedRooms: archivedQuery.data ?? [],
		archivedLoading: archivedQuery.isLoading,
		isArchivedError: archivedQuery.isError && archivedQuery.data === undefined,
		onRetryArchived: archivedQuery.refetch,
		isLoading: roomsQuery.isLoading,
		isFetching: roomsQuery.isFetching || archivedQuery.isFetching,
		isError: roomsQuery.isError,
		isInitialLoadError: roomsQuery.isError && roomsQuery.data === undefined,
		onRetry: roomsQuery.refetch,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isArchivePending: archiveMutation.isPending,
		isRestorePending: restoreMutation.isPending,
		isToggleFavoritePending: toggleFavoriteMutation.isPending,
		create: (values: RoomValues) => createMutation.mutateAsync(values),
		update: (values: RoomValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		archive: (id: string) => archiveMutation.mutateAsync(id),
		restore: (id: string) => restoreMutation.mutateAsync(id),
		toggleFavorite: (id: string) => toggleFavoriteMutation.mutateAsync(id),
	};
}
