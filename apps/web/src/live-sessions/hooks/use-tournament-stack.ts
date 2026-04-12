import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTournamentStack({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const tournamentId = sessionQuery.data?.tournamentId ?? null;

	const chipPurchaseTypesQuery = useQuery({
		...trpc.tournamentChipPurchase.listByTournament.queryOptions({
			tournamentId: tournamentId ?? "",
		}),
		enabled: !!tournamentId,
	});
	const chipPurchaseTypes = (chipPurchaseTypesQuery.data ?? []).map((t) => ({
		name: t.name,
		cost: t.cost,
		chips: t.chips,
	}));

	const sessionKey = trpc.liveTournamentSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const eventsKey = trpc.sessionEvent.list.queryOptions({
		liveTournamentSessionId: sessionId,
	}).queryKey;
	const listKey = trpc.liveTournamentSession.list.queryOptions({}).queryKey;

	const invalidateSession = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: sessionKey }),
			queryClient.invalidateQueries({ queryKey: eventsKey }),
		]);
	};

	const stackMutation = useMutation({
		mutationFn: (values: { stackAmount: number }) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "update_stack",
				payload: {
					stackAmount: values.stackAmount,
				},
			}),
		onSuccess: invalidateSession,
	});

	const completeMutation = useMutation({
		mutationFn: (
			values:
				| {
						beforeDeadline: false;
						bountyPrizes: number;
						placement: number;
						prizeMoney: number;
						totalEntries: number;
				  }
				| {
						beforeDeadline: true;
						bountyPrizes: number;
						prizeMoney: number;
				  }
		) =>
			trpcClient.liveTournamentSession.complete.mutate({
				id: sessionId,
				...values,
			}),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({
					queryKey: trpc.session.list.queryOptions({}).queryKey,
				}),
			]);
			await navigate({ to: "/sessions" });
		},
	});

	return {
		chipPurchaseTypes,
		recordStack: (values: { stackAmount: number }) =>
			stackMutation.mutate(values),
		complete: (
			values:
				| {
						beforeDeadline: false;
						bountyPrizes: number;
						placement: number;
						prizeMoney: number;
						totalEntries: number;
				  }
				| {
						beforeDeadline: true;
						bountyPrizes: number;
						prizeMoney: number;
				  }
		) => completeMutation.mutate(values),
		isStackPending: stackMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
