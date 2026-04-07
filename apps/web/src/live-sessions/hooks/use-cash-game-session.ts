import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { trpc, trpcClient } from "@/utils/trpc";

export function useCashGameSession(sessionId: string) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const sessionQuery = useQuery({
		...trpc.liveCashGameSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
		refetchInterval: 5000,
	});
	const session = sessionQuery.data;

	const ringGameQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({
			storeId: session?.storeId ?? "",
		}),
		enabled: !!session?.storeId,
	});

	const discardMutation = useMutation({
		mutationFn: () =>
			trpcClient.liveCashGameSession.discard.mutate({ id: sessionId }),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: trpc.liveCashGameSession.list.queryOptions({}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.session.list.queryOptions({}).queryKey,
				}),
			]);
			await navigate({ to: "/sessions" });
		},
	});

	const ringGames = ringGameQuery.data ?? [];

	return {
		session,
		ringGames,
		isDiscardPending: discardMutation.isPending,
		discard: () => {
			discardMutation.mutate();
		},
	};
}
