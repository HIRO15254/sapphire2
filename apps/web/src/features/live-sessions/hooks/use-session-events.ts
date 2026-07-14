import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface SessionEvent {
	eventType: string;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
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

	const activeMutationsRef = useRef(0);
	const eventQueryInput =
		sessionType === "tournament"
			? { liveTournamentSessionId: sessionId }
			: { liveCashGameSessionId: sessionId };
	const eventsQueryOptions =
		trpc.sessionEvent.list.queryOptions(eventQueryInput);
	const eventsQuery = useQuery({
		...eventsQueryOptions,
		enabled: !!sessionId,
		...(refetchInterval
			? {
					refetchInterval: () =>
						activeMutationsRef.current > 0 ? false : refetchInterval,
				}
			: {}),
	});
	const events = (eventsQuery.data ?? []) as SessionEvent[];

	const sessionKey =
		sessionType === "tournament"
			? trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
					.queryKey
			: trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
					.queryKey;

	const sessionListKey =
		sessionType === "tournament"
			? trpc.liveTournamentSession.list.queryOptions({}).queryKey
			: trpc.liveCashGameSession.list.queryOptions({}).queryKey;

	const invalidateAll = async () => {
		await invalidateTargets(queryClient, [
			{ queryKey: eventsQueryOptions.queryKey },
			{ queryKey: sessionKey },
			{ filters: { queryKey: sessionListKey } },
		]);
	};

	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onMutate: async (args) => {
			activeMutationsRef.current += 1;
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			updateQueryItems<SessionEvent>(
				queryClient,
				eventsQueryOptions.queryKey,
				(old) =>
					old.map((event) =>
						event.id === args.id
							? {
									...event,
									occurredAt: args.occurredAt
										? new Date(args.occurredAt * 1000).toISOString()
										: event.occurredAt,
									payload: args.payload ?? event.payload,
								}
							: event
					)
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
		onSettled: () => {
			activeMutationsRef.current = Math.max(0, activeMutationsRef.current - 1);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onMutate: async (id) => {
			activeMutationsRef.current += 1;
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			updateQueryItems<SessionEvent>(
				queryClient,
				eventsQueryOptions.queryKey,
				(old) => old.filter((event) => event.id !== id)
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
		onSettled: () => {
			activeMutationsRef.current = Math.max(0, activeMutationsRef.current - 1);
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
