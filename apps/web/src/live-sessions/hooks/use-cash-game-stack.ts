import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createSessionEventMutationOptions } from "@/live-sessions/utils/optimistic-session-event";
import { trpc, trpcClient } from "@/utils/trpc";

export function useCashGameStack({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const listKey = trpc.liveCashGameSession.list.queryOptions({}).queryKey;

	const stackMutation = useMutation({
		mutationFn: (values: { stackAmount: number }) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "update_stack",
				payload: { stackAmount: values.stackAmount },
			}),
		...createSessionEventMutationOptions<{ stackAmount: number }>({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "update_stack",
			getPayload: (values) => ({ stackAmount: values.stackAmount }),
		}),
	});

	const chipAddMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "chips_add_remove",
				payload: { amount, type: "add" },
			}),
		...createSessionEventMutationOptions<number>({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "chips_add_remove",
			getPayload: (amount) => ({ amount, type: "add" }),
		}),
	});

	const chipRemoveMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "chips_add_remove",
				payload: { amount, type: "remove" },
			}),
		...createSessionEventMutationOptions<number>({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "chips_add_remove",
			getPayload: (amount) => ({ amount, type: "remove" }),
		}),
	});

	const allInMutation = useMutation({
		mutationFn: (values: {
			potSize: number;
			trials: number;
			equity: number;
			wins: number;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "all_in",
				payload: values,
			}),
		...createSessionEventMutationOptions<{
			potSize: number;
			trials: number;
			equity: number;
			wins: number;
		}>({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "all_in",
			getPayload: (values) => values,
		}),
	});

	const memoMutation = useMutation({
		mutationFn: (text: string) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "memo",
				payload: { text },
			}),
		...createSessionEventMutationOptions<string>({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "memo",
			getPayload: (text) => ({ text }),
		}),
	});

	const pauseMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "session_pause",
				payload: {},
			}),
		...createSessionEventMutationOptions({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "session_pause",
			getPayload: () => ({}),
			changesStatus: true,
		}),
	});

	const resumeMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "session_resume",
				payload: {},
			}),
		...createSessionEventMutationOptions({
			queryClient,
			sessionId,
			sessionType: "cash_game",
			eventType: "session_resume",
			getPayload: () => ({}),
			changesStatus: true,
		}),
	});

	const completeMutation = useMutation({
		mutationFn: (values: { finalStack: number }) =>
			trpcClient.liveCashGameSession.complete.mutate({
				id: sessionId,
				finalStack: values.finalStack,
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
		recordStack: (values: { stackAmount: number }) =>
			stackMutation.mutate(values),
		addChip: (amount: number) => chipAddMutation.mutate(amount),
		removeChip: (amount: number) => chipRemoveMutation.mutate(amount),
		addAllIn: (values: {
			potSize: number;
			trials: number;
			equity: number;
			wins: number;
		}) => allInMutation.mutate(values),
		addMemo: (text: string) => memoMutation.mutate(text),
		pause: () => pauseMutation.mutate(),
		resume: () => resumeMutation.mutate(),
		complete: (values: { finalStack: number }) =>
			completeMutation.mutate(values),
		isStackPending: stackMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
