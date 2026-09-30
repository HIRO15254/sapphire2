import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { createSessionEventMutationOptions } from "@/features/live-sessions/utils/optimistic-session-event";
import { trpcClient } from "@/utils/trpc";

type SessionType = "cash_game" | "tournament";

export type LoggableEventType =
	| "all_in"
	| "chips_add_remove"
	| "memo"
	| "purchase_chips";

export interface LogEventArgs {
	occurredAt?: number;
	payload: Record<string, unknown>;
}

interface LogMutationOptions {
	eventType: LoggableEventType;
	queryClient: QueryClient;
	sessionId: string;
	sessionType: SessionType;
}

function toSessionParam(sessionId: string, sessionType: SessionType) {
	return sessionType === "tournament"
		? { liveTournamentSessionId: sessionId }
		: { liveCashGameSessionId: sessionId };
}

function useLogMutation({
	eventType,
	queryClient,
	sessionId,
	sessionType,
}: LogMutationOptions) {
	return useMutation({
		mutationFn: (args: LogEventArgs) =>
			trpcClient.sessionEvent.create.mutate({
				...toSessionParam(sessionId, sessionType),
				eventType,
				occurredAt: args.occurredAt,
				payload: args.payload,
			}),
		...createSessionEventMutationOptions<LogEventArgs>({
			eventType,
			getOccurredAt: (args) => args.occurredAt,
			getPayload: (args) => args.payload,
			queryClient,
			sessionId,
			sessionType,
		}),
	});
}

export function useSessionEventLog({
	sessionId,
	sessionType,
}: {
	sessionId: string;
	sessionType: SessionType;
}) {
	const queryClient = useQueryClient();
	const shared = { queryClient, sessionId, sessionType };

	const allIn = useLogMutation({ ...shared, eventType: "all_in" });
	const chips = useLogMutation({ ...shared, eventType: "chips_add_remove" });
	const memo = useLogMutation({ ...shared, eventType: "memo" });
	const purchase = useLogMutation({ ...shared, eventType: "purchase_chips" });

	const mutations: Record<LoggableEventType, typeof memo> = {
		all_in: allIn,
		chips_add_remove: chips,
		memo,
		purchase_chips: purchase,
	};

	return {
		isLogPending:
			allIn.isPending ||
			chips.isPending ||
			memo.isPending ||
			purchase.isPending,
		log: (eventType: LoggableEventType, args: LogEventArgs) =>
			mutations[eventType].mutateAsync(args),
	};
}
