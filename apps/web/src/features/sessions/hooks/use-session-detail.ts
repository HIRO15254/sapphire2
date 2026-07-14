import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	buildLiveLinkedUpdatePayload,
	buildUpdatePayload,
	type SessionFormValues,
	type SessionItem,
} from "@/features/sessions/hooks/use-sessions";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

type UpdateInput = SessionFormValues & { id: string; isLiveLinked?: boolean };

/**
 * Detail-page data hook for a single session. Fetches the enriched session via
 * `session.getById` (same shape as a list item) and exposes update / delete /
 * reopen / tag-create mutations. Mutations invalidate both the detail query and
 * every `session.list` variant so the list reflects the change on return.
 */
export function useSessionDetail(sessionId: string) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const sessionKey = trpc.session.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	// No-input list key — prefix-matches every filtered `session.list` variant.
	const sessionListKey = trpc.session.list.queryKey();
	const tagsKey = trpc.sessionTag.list.queryOptions().queryKey;

	const sessionQuery = useQuery({
		...trpc.session.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const session = (sessionQuery.data ?? null) as SessionItem | null;

	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const availableTags = tagsQuery.data ?? [];

	const createTagMutation = useMutation({
		mutationFn: (name: string) => trpcClient.sessionTag.create.mutate({ name }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagsKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: UpdateInput) =>
			trpcClient.session.update.mutate(
				values.isLiveLinked
					? buildLiveLinkedUpdatePayload(values)
					: buildUpdatePayload(values)
			),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: sessionKey },
				{ queryKey: sessionListKey },
			]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.session.delete.mutate({ id }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
		},
	});

	const reopenMutation = useMutation({
		mutationFn: (liveCashGameSessionId: string) =>
			trpcClient.liveCashGameSession.reopen.mutate({
				id: liveCashGameSessionId,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: sessionListKey },
				{
					queryKey: trpc.liveCashGameSession.list.queryOptions({}).queryKey,
				},
			]);
			await navigate({ to: "/active-session" });
		},
	});

	return {
		session,
		availableTags,
		isLoading: sessionQuery.isLoading,
		isUpdatePending: updateMutation.isPending,
		update: (values: UpdateInput) => updateMutation.mutateAsync(values),
		deleteSession: (id: string) => {
			deleteMutation.mutate(id);
		},
		reopen: (liveCashGameSessionId: string) => {
			reopenMutation.mutate(liveCashGameSessionId);
		},
		createTag: async (name: string) => {
			const result = await createTagMutation.mutateAsync(name);
			if (!result) {
				throw new Error("Failed to create session tag");
			}
			return { id: result.id, name: result.name };
		},
	};
}
