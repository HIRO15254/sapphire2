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
		mutationFn: (values: {
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
			chipPurchases: Array<{ name: string; cost: number; chips: number }>;
			remainingPlayers: number | null;
			stackAmount: number;
			totalEntries: number | null;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "tournament_stack_record",
				payload: {
					stackAmount: values.stackAmount,
					remainingPlayers: values.remainingPlayers,
					totalEntries: values.totalEntries,
					chipPurchases: values.chipPurchases,
					chipPurchaseCounts: values.chipPurchaseCounts,
				},
			}),
		onSuccess: invalidateSession,
	});

	const completeMutation = useMutation({
		mutationFn: (values: {
			bountyPrizes?: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
		}) =>
			trpcClient.liveTournamentSession.complete.mutate({
				id: sessionId,
				placement: values.placement,
				totalEntries: values.totalEntries,
				prizeMoney: values.prizeMoney,
				bountyPrizes: values.bountyPrizes,
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
		recordStack: (values: {
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
			chipPurchases: Array<{ name: string; cost: number; chips: number }>;
			remainingPlayers: number | null;
			stackAmount: number;
			totalEntries: number | null;
		}) => stackMutation.mutate(values),
		complete: (values: {
			bountyPrizes?: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
		}) => completeMutation.mutate(values),
		isStackPending: stackMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
