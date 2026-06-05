import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface RoomValues {
	memo?: string;
	name: string;
}

export interface RoomItem {
	id: string;
	memo?: string | null;
	name: string;
	ringGameCount: number;
	tournamentCount: number;
}

export function useRooms() {
	const queryClient = useQueryClient();
	const roomListKey = trpc.room.list.queryOptions().queryKey;

	const roomsQuery = useQuery(trpc.room.list.queryOptions());
	const rooms = roomsQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: RoomValues) => trpcClient.room.create.mutate(values),
		onMutate: async (newRoom) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			queryClient.setQueryData(roomListKey, (old) => {
				if (!old) {
					return old;
				}
				const base = old[0];
				return [
					...old,
					{
						...base,
						id: `temp-${Date.now()}`,
						name: newRoom.name,
						memo: newRoom.memo ?? null,
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
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: roomListKey }]);
		},
	});

	const updateMutation = useMutation({
		// Send an explicit `null` for a cleared memo so the server overwrites it
		// rather than treating the omitted (undefined) key as "leave unchanged".
		mutationFn: (values: RoomValues & { id: string }) =>
			trpcClient.room.update.mutate({
				id: values.id,
				name: values.name,
				memo: values.memo ?? null,
			}),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			queryClient.setQueryData(roomListKey, (old) =>
				old?.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: roomListKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.room.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: roomListKey }]);
			const previous = snapshotQuery(queryClient, roomListKey);
			queryClient.setQueryData(roomListKey, (old) =>
				old?.filter((s) => s.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: roomListKey }]);
		},
	});

	return {
		rooms,
		isLoading: roomsQuery.isLoading,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: RoomValues) => createMutation.mutateAsync(values),
		update: (values: RoomValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => {
			deleteMutation.mutate(id);
		},
	};
}
