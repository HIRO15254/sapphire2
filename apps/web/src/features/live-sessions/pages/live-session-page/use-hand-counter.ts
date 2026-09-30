import type { SessionStatus } from "@sapphire2/db/constants/session-event-types";
import { useState } from "react";
import {
	type HandTrackingPatch,
	useHandTracking,
} from "@/features/live-sessions/hooks/use-hand-tracking";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import {
	computeHandsPerHour,
	resolveDealerSeat,
	seatedPositions,
	stepDealerSeat,
} from "@/features/live-sessions/utils/hand-tracking";
import { formatNumber } from "@/utils/format-number";

interface UseHandCounterOptions {
	activeSeconds: number;
	dealerSeat: number | null | undefined;
	handCount: number | null | undefined;
	seats: readonly SeatEntry[];
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

function withDealerSeat(
	patch: HandTrackingPatch,
	dealerSeat: number | null
): HandTrackingPatch {
	return dealerSeat === null ? patch : { ...patch, dealerSeat };
}

export function useHandCounter({
	activeSeconds,
	dealerSeat,
	handCount,
	seats,
	sessionId,
	sessionType,
	status,
}: UseHandCounterOptions): HandCounterView {
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const canEdit = status === "active";
	const { onWrite } = useHandTracking({ canEdit, sessionId, sessionType });

	const seated = seatedPositions(seats);
	const dealerIndex = resolveDealerSeat(dealerSeat ?? null, seated);
	const handsPerHour = computeHandsPerHour(handCount ?? null, activeSeconds);

	const moveDealer = (step: number) =>
		onWrite((current) =>
			withDealerSeat({}, stepDealerSeat(current.dealerSeat, step, seated))
		);

	return {
		canEdit,
		dealerSeatIndex: dealerIndex,
		dealerSeatLabel: dealerIndex === null ? "—" : `S${dealerIndex + 1}`,
		handCount: handCount ?? 0,
		handsPerHour: handsPerHour === null ? "—" : formatNumber(handsPerHour),
		isSheetOpen,
		onAddHand: () =>
			onWrite((current) =>
				withDealerSeat(
					{ handCount: (current.handCount ?? 0) + 1 },
					stepDealerSeat(current.dealerSeat, 1, seated)
				)
			),
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
					? withDealerSeat(
							{ handCount: (current.handCount ?? 0) - 1 },
							stepDealerSeat(current.dealerSeat, -1, seated)
						)
					: {}
			),
		onSheetOpenChange: setIsSheetOpen,
	};
}
