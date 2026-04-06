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
		mutationFn: (values: {
			allIns: Array<{
				potSize: number;
				trials: number;
				equity: number;
				wins: number;
			}>;
			stackAmount: number;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "stack_record",
				payload: { stackAmount: values.stackAmount, allIns: values.allIns },
			}),
		onSuccess: invalidateSession,
	});

	const chipAddMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "chip_add",
				payload: { amount },
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
			await queryClient.invalidateQueries({ queryKey: listKey });
			await navigate({ to: "/sessions" });
		},
	});

	return {
		recordStack: (values: {
			allIns: Array<{
				potSize: number;
				trials: number;
				equity: number;
				wins: number;
			}>;
			stackAmount: number;
		}) => stackMutation.mutate(values),
		addChip: (amount: number) => chipAddMutation.mutate(amount),
		complete: (values: { finalStack: number }) =>
			completeMutation.mutate(values),
		isStackPending: stackMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
