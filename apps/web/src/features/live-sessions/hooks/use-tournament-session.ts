import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTournamentSession(sessionId: string) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const sessionQueryOptions = trpc.liveTournamentSession.getById.queryOptions({
		id: sessionId,
	});
	const sessionQuery = useQuery({
		...sessionQueryOptions,
		enabled: !!sessionId,
		refetchInterval: 5000,
	});
	const session = sessionQuery.data;

	const discardMutation = useMutation({
		mutationFn: () =>
			trpcClient.liveTournamentSession.discard.mutate({ id: sessionId }),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: trpc.liveTournamentSession.list.queryOptions({}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.session.list.queryOptions({}).queryKey,
				}),
			]);
			await navigate({ to: "/sessions" });
		},
	});

	const updateTimerMutation = useMutation({
		mutationFn: (timerStartedAt: Date | null) =>
			trpcClient.liveTournamentSession.update.mutate({
				id: sessionId,
				timerStartedAt:
					timerStartedAt === null
						? null
						: Math.floor(timerStartedAt.getTime() / 1000),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
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
