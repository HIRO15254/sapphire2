import type { SessionStatus } from "@sapphire2/db/constants/session-event-types";
import { useState } from "react";
import { useHandTracking } from "@/features/live-sessions/hooks/use-hand-tracking";
import {
	computeHandsPerHour,
	dealerSeatIndex,
	shiftDealerOffset,
} from "@/features/live-sessions/utils/hand-tracking";
import { formatNumber } from "@/utils/format-number";

interface UseHandCounterOptions {
	activeSeconds: number;
	dealerOffset: number | null | undefined;
	handCount: number | null | undefined;
	seatCount: number;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
	status: SessionStatus;
}

export interface HandCounterView {
	canEdit: boolean;
	dealerSeatIndex: number | null;
	dealerSeatLabel: string;
	handCount: number;
	handsPerHour: string;
	isSheetOpen: boolean;
	onAddHand: () => void;
	onMoveDealerBack: () => void;
	onMoveDealerForward: () => void;
	onOpenSheet: () => void;
	onRemoveHand: () => void;
	onSheetOpenChange: (open: boolean) => void;
}

export function useHandCounter({
	activeSeconds,
	dealerOffset,
	handCount,
	seatCount,
	sessionId,
	sessionType,
	status,
}: UseHandCounterOptions): HandCounterView {
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const canEdit = status === "active";
	const { onWrite } = useHandTracking({ canEdit, sessionId, sessionType });

	const dealerIndex = dealerSeatIndex(
		handCount ?? null,
		dealerOffset ?? 0,
		seatCount
	);
	const handsPerHour = computeHandsPerHour(handCount ?? null, activeSeconds);

	const moveDealer = (step: number) =>
		onWrite((current) => ({
			dealerOffset: shiftDealerOffset(current.dealerOffset, step, seatCount),
		}));

	return {
		canEdit,
		dealerSeatIndex: dealerIndex,
		dealerSeatLabel: dealerIndex === null ? "—" : `S${dealerIndex + 1}`,
		handCount: handCount ?? 0,
		handsPerHour: handsPerHour === null ? "—" : formatNumber(handsPerHour),
		isSheetOpen,
		onAddHand: () =>
			onWrite((current) => ({ handCount: (current.handCount ?? 0) + 1 })),
		onMoveDealerBack: () => moveDealer(-1),
		onMoveDealerForward: () => moveDealer(1),
		onOpenSheet: () => {
			if (canEdit) {
				setIsSheetOpen(true);
			}
		},
		onRemoveHand: () =>
			onWrite((current) =>
				(current.handCount ?? 0) > 0
					? { handCount: (current.handCount ?? 0) - 1 }
					: {}
			),
		onSheetOpenChange: setIsSheetOpen,
	};
}
