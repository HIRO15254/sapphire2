import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
} from "@/live-sessions/lib/live-session-cache";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTournamentSession(sessionId: string) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const refs = getLiveSessionCacheRefs({
		sessionId,
		sessionType: "tournament",
	});

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
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeHistorical: true,
			});
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
