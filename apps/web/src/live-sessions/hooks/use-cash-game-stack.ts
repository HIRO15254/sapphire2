import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { trpc, trpcClient } from "@/utils/trpc";

export function useCashGameStack({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const sessionKey = trpc.liveCashGameSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const eventsKey = trpc.sessionEvent.list.queryOptions({
		liveCashGameSessionId: sessionId,
	}).queryKey;
	const listKey = trpc.liveCashGameSession.list.queryOptions({}).queryKey;

	const invalidateSession = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: sessionKey }),
			queryClient.invalidateQueries({ queryKey: eventsKey }),
		]);
	};

	const stackMutation = useMutation({
		mutationFn: (values: { stackAmount: number }) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "update_stack",
				payload: { stackAmount: values.stackAmount },
			}),
		onSuccess: invalidateSession,
	});

	const chipAddMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "chips_add_remove",
				payload: { amount, type: "add" },
			}),
		onSuccess: invalidateSession,
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
		complete: (values: { finalStack: number }) =>
			completeMutation.mutate(values),
		isStackPending: stackMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
