import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface SessionTag {
	id: string;
	name: string;
}

export function useSessionTags() {
	const queryClient = useQueryClient();
	const tagsKey = trpc.sessionTag.list.queryOptions().queryKey;

	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const tags = (tagsQuery.data ?? []) as SessionTag[];

	const updateMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			trpcClient.sessionTag.update.mutate({ id, name }),
		onMutate: async ({ id, name }) => {
			await cancelTargets(queryClient, [{ queryKey: tagsKey }]);
			const previous = snapshotQuery(queryClient, tagsKey);
			queryClient.setQueryData<SessionTag[]>(
				tagsKey,
				(old) =>
					old?.map((tag) => (tag.id === id ? { ...tag, name } : tag)) ?? []
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagsKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionTag.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: tagsKey }]);
			const previous = snapshotQuery(queryClient, tagsKey);
			queryClient.setQueryData<SessionTag[]>(
				tagsKey,
				(old) => old?.filter((tag) => tag.id !== id) ?? []
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagsKey }]);
		},
	});

	return {
		tags,
		update: (params: { id: string; name: string }) =>
			updateMutation.mutateAsync(params),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
	};
}
