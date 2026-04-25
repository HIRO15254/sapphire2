import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildOptimisticSessionSummary } from "@/features/live-sessions/utils/optimistic-session-event";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface SessionEvent {
	eventType: string;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
}

interface SessionSummaryData {
	summary?: Record<string, unknown>;
	[key: string]: unknown;
}

type SessionType = "cash_game" | "tournament";

export function useSessionEvents({
	sessionId,
	sessionType,
	refetchInterval,
}: {
	sessionId: string;
	sessionType: SessionType;
	refetchInterval?: number;
}) {
	const queryClient = useQueryClient();

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

	const sessionKey =
		sessionType === "tournament"
			? trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
					.queryKey
			: trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
					.queryKey;

	const applyEventSummaryToSession = (
		event: SessionEvent,
		payload: unknown,
		occurredAt?: number
	) => {
		queryClient.setQueryData<SessionSummaryData>(sessionKey, (old) => {
			if (!(old?.summary && payload) || typeof payload !== "object") {
				return old;
			}

			return {
				...old,
				summary: buildOptimisticSessionSummary(
					old.summary,
					event.eventType,
					payload as Record<string, unknown>,
					occurredAt
				),
			};
		});
	};

	const invalidateAll = async () => {
		await invalidateTargets(queryClient, [
			{ queryKey: eventsQueryOptions.queryKey },
			{ queryKey: sessionKey },
		]);
	};

	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onMutate: async (args) => {
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			const targetEvent = events.find((event) => event.id === args.id);
			queryClient.setQueryData<SessionEvent[]>(
				eventsQueryOptions.queryKey,
				(old) =>
					old?.map((event) =>
						event.id === args.id
							? {
									...event,
									occurredAt: args.occurredAt
										? new Date(args.occurredAt * 1000).toISOString()
										: event.occurredAt,
									payload: args.payload ?? event.payload,
								}
							: event
					) ?? []
			);
			if (targetEvent && args.payload) {
				applyEventSummaryToSession(targetEvent, args.payload, args.occurredAt);
			}
			return { previousEvents, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousEvents,
				context?.previousSession,
			]);
		},
		onSuccess: async () => {
			await invalidateAll();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			queryClient.setQueryData<SessionEvent[]>(
				eventsQueryOptions.queryKey,
				(old) => old?.filter((event) => event.id !== id) ?? []
			);
			return { previousEvents, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousEvents,
				context?.previousSession,
			]);
		},
		onSuccess: async () => {
			await invalidateAll();
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
