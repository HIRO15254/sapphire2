import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTournamentSession(sessionId: string) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
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

	return {
		session,
		isDiscardPending: discardMutation.isPending,
		discard: () => {
			discardMutation.mutate();
		},
	};
}
