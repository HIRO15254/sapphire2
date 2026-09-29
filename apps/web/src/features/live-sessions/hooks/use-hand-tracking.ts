import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import {
	beginOptimisticQueryUpdate,
	invalidateTargets,
	updateQueryEntity,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface HandTrackingState {
	dealerOffset: number;
	handCount: number | null;
}

export type HandTrackingPatch = Partial<{
	dealerOffset: number;
	handCount: number;
}>;

interface HandTrackingEntity {
	dealerOffset?: number | null;
	handCount?: number | null;
}

type SettleHandle = ReturnType<typeof beginOptimisticQueryUpdate>;

interface QueuedWrite {
	handles: SettleHandle[];
	patch: HandTrackingPatch;
}

interface WriteQueue {
	inFlight: boolean;
	next: QueuedWrite | null;
}

interface UseHandTrackingOptions {
	canEdit: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

function liveKeyFor(
	sessionType: "cash_game" | "tournament",
	sessionId: string
): QueryKey {
	return sessionType === "cash_game"
		? trpc.liveCashGameSession.getById.queryOptions({ id: sessionId }).queryKey
		: trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
				.queryKey;
}

function sendPatch(
	sessionType: "cash_game" | "tournament",
	id: string,
	patch: HandTrackingPatch
): Promise<unknown> {
	return sessionType === "cash_game"
		? trpcClient.liveCashGameSession.update.mutate({ id, ...patch })
		: trpcClient.liveTournamentSession.update.mutate({ id, ...patch });
}

export function useHandTracking({
	canEdit,
	sessionId,
	sessionType,
}: UseHandTrackingOptions) {
	const queryClient = useQueryClient();
	const liveKey = liveKeyFor(sessionType, sessionId);
	const queueRef = useRef<WriteQueue>({ inFlight: false, next: null });

	const readCurrent = (): HandTrackingState => {
		const entity = queryClient.getQueryData<HandTrackingEntity>(liveKey);
		return {
			dealerOffset: entity?.dealerOffset ?? 0,
			handCount: entity?.handCount ?? null,
		};
	};

	const drain = async (write: QueuedWrite): Promise<void> => {
		const queue = queueRef.current;
		queue.inFlight = true;
		let succeeded = true;
		try {
			await sendPatch(sessionType, sessionId, write.patch);
		} catch {
			succeeded = false;
			toast.error("Couldn't save the hand count");
		}
		for (const handle of write.handles) {
			handle.settle(succeeded);
		}
		const next = queue.next;
		queue.next = null;
		if (next !== null) {
			await drain(next);
			return;
		}
		queue.inFlight = false;
		await invalidateTargets(queryClient, [{ queryKey: liveKey }]);
	};

	const write = (
		project: (current: HandTrackingState) => HandTrackingPatch
	) => {
		if (!canEdit) {
			return;
		}
		const patch = project(readCurrent());
		if (Object.keys(patch).length === 0) {
			return;
		}
		const handle = beginOptimisticQueryUpdate(queryClient, liveKey, () =>
			updateQueryEntity<HandTrackingEntity>(queryClient, liveKey, patch)
		);
		const queue = queueRef.current;
		if (queue.inFlight) {
			queue.next = {
				handles: [...(queue.next?.handles ?? []), handle],
				patch: { ...queue.next?.patch, ...patch },
			};
			return;
		}
		drain({ handles: [handle], patch }).catch(() => undefined);
	};

	return {
		onWrite: write,
	};
}
