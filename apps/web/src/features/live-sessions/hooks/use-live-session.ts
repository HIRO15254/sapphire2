import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export function useLiveSession(sessionId: string) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const sessionQueryOptions = trpc.liveSession.getById.queryOptions({
		id: sessionId,
	});
	const sessionQuery = useQuery({
		...sessionQueryOptions,
		enabled: !!sessionId,
		refetchInterval: 5000,
	});
	const session = sessionQuery.data;

	const listKey = trpc.session.list.queryOptions({}).queryKey;

	const discardMutation = useMutation({
		mutationFn: () => trpcClient.liveSession.discard.mutate({ id: sessionId }),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: listKey },
				{
					queryKey: trpc.liveSession.getById.queryOptions({ id: sessionId })
						.queryKey,
				},
			]);
			await navigate({ to: "/sessions" });
		},
	});

	const updateTimerMutation = useMutation({
		mutationFn: (timerStartedAt: Date | null) =>
			trpcClient.liveSession.updateRule.mutate({
				id: sessionId,
				kind: "tournament",
				timerStartedAt,
			}),
		onSuccess: () => {
			invalidateTargets(queryClient, [
				{ queryKey: sessionQueryOptions.queryKey },
			]);
		},
	});

	return {
		session,
		isDiscardPending: discardMutation.isPending,
		discard: () => {
			discardMutation.mutate();
		},
		isUpdatingTimer: updateTimerMutation.isPending,
		updateTimerStartedAt: (value: Date | null) => {
			updateTimerMutation.mutate(value);
		},
	};
}
