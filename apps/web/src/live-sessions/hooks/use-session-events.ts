import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	applyOptimisticLiveSessionEvent,
	cancelLiveSessionCaches,
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
	type LiveSessionEvent,
	type LiveSessionType,
	patchLiveSessionEvents,
	restoreLiveSessionCaches,
	snapshotLiveSessionCaches,
} from "@/live-sessions/lib/live-session-cache";
import { trpc, trpcClient } from "@/utils/trpc";

export interface SessionEvent extends LiveSessionEvent {}

export function useSessionEvents({
	sessionId,
	sessionType,
	refetchInterval,
}: {
	sessionId: string;
	sessionType: LiveSessionType;
	refetchInterval?: number;
}) {
	const queryClient = useQueryClient();
	const refs = getLiveSessionCacheRefs({ sessionId, sessionType });

	const eventQueryInput =
		sessionType === "tournament"
			? { liveTournamentSessionId: sessionId }
			: { liveCashGameSessionId: sessionId };
	const eventsQueryOptions =
		trpc.sessionEvent.list.queryOptions(eventQueryInput);
	const eventsQuery = useQuery({
		...eventsQueryOptions,
		enabled: !!sessionId,
		...(refetchInterval ? { refetchInterval } : {}),
	});
	const events = (eventsQuery.data ?? []) as SessionEvent[];

	const cashSessionQuery = useQuery({
		...trpc.liveCashGameSession.getById.queryOptions({
			id: sessionId,
		}),
		enabled: !!sessionId && sessionType === "cash_game",
	});
	const tournamentSessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({
			id: sessionId,
		}),
		enabled: !!sessionId && sessionType === "tournament",
	});

	const currencyId =
		sessionType === "cash_game"
			? (cashSessionQuery.data?.currencyId ?? null)
			: (tournamentSessionQuery.data?.currencyId ?? null);

	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onMutate: async (args) => {
			await cancelLiveSessionCaches(queryClient, refs, {
				includeLists: false,
				includePlayers: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);
			const targetEvent = events.find((event) => event.id === args.id);

			if (targetEvent) {
				applyOptimisticLiveSessionEvent(queryClient, refs, {
					event: targetEvent,
					eventType: targetEvent.eventType,
					occurredAt: args.occurredAt,
					payload: args.payload ?? targetEvent.payload,
				});
			}

			return { snapshot };
		},
		onError: (_error, _variables, context) => {
			restoreLiveSessionCaches(queryClient, context?.snapshot);
		},
		onSuccess: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				currencyId,
				includeHistorical: true,
				includePlayers: false,
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelLiveSessionCaches(queryClient, refs, {
				includeLists: false,
				includePlayers: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);

			patchLiveSessionEvents(queryClient, refs, (currentEvents) =>
				currentEvents.filter((event) => event.id !== id)
			);

			return { snapshot };
		},
		onError: (_error, _variables, context) => {
			restoreLiveSessionCaches(queryClient, context?.snapshot);
		},
		onSuccess: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				currencyId,
				includeHistorical: true,
				includePlayers: false,
			});
		},
	});

	return {
		events,
		update: (args: { id: string; payload?: unknown; occurredAt?: number }) =>
			updateMutation.mutateAsync(args),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
	};
}
