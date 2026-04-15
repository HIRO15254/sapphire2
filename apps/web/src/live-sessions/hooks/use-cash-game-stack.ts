import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	applyOptimisticLiveSessionEvent,
	cancelLiveSessionCaches,
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
	type LiveSessionEvent,
	type LiveSessionEventType,
	restoreLiveSessionCaches,
	snapshotLiveSessionCaches,
} from "@/live-sessions/lib/live-session-cache";
import { trpcClient } from "@/utils/trpc";

function buildOptimisticEvent(
	eventType: LiveSessionEventType,
	payload: unknown
): LiveSessionEvent {
	return {
		eventType,
		id: `optimistic-${Date.now()}`,
		occurredAt: new Date().toISOString(),
		payload,
	};
}

export function useCashGameStack({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const refs = getLiveSessionCacheRefs({
		sessionId,
		sessionType: "cash_game",
	});

	const applyCreateEventMutation = useMutation({
		mutationFn: ({
			eventType,
			payload,
		}: {
			eventType: LiveSessionEventType;
			payload: unknown;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType,
				payload,
			}),
		onMutate: async ({ eventType, payload }) => {
			await cancelLiveSessionCaches(queryClient, refs);
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);

			applyOptimisticLiveSessionEvent(queryClient, refs, {
				event: buildOptimisticEvent(eventType, payload),
				eventType,
				payload,
			});

			return { snapshot };
		},
		onError: (_error, _variables, context) => {
			restoreLiveSessionCaches(queryClient, context?.snapshot);
		},
		onSettled: async () => {
			await invalidateLiveSessionCaches(queryClient, refs);
		},
	});

	const completeMutation = useMutation({
		mutationFn: (values: { finalStack: number }) =>
			trpcClient.liveCashGameSession.complete.mutate({
				id: sessionId,
				finalStack: values.finalStack,
			}),
		onSuccess: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeHistorical: true,
			});
			await navigate({ to: "/sessions" });
		},
	});

	return {
		recordStack: (values: { stackAmount: number }) =>
			applyCreateEventMutation.mutate({
				eventType: "update_stack",
				payload: { stackAmount: values.stackAmount },
			}),
		addChip: (amount: number) =>
			applyCreateEventMutation.mutate({
				eventType: "chips_add_remove",
				payload: { amount, type: "add" },
			}),
		removeChip: (amount: number) =>
			applyCreateEventMutation.mutate({
				eventType: "chips_add_remove",
				payload: { amount, type: "remove" },
			}),
		addAllIn: (values: {
			potSize: number;
			trials: number;
			equity: number;
			wins: number;
		}) =>
			applyCreateEventMutation.mutate({
				eventType: "all_in",
				payload: values,
			}),
		addMemo: (text: string) =>
			applyCreateEventMutation.mutate({
				eventType: "memo",
				payload: { text },
			}),
		pause: () =>
			applyCreateEventMutation.mutate({
				eventType: "session_pause",
				payload: {},
			}),
		resume: () =>
			applyCreateEventMutation.mutate({
				eventType: "session_resume",
				payload: {},
			}),
		complete: (values: { finalStack: number }) =>
			completeMutation.mutate(values),
		isStackPending: applyCreateEventMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
