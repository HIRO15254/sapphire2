import {
	TABLE_PLAYER_SOURCE_APPS,
	type TablePlayerSourceApp,
} from "@sapphire2/api/routers/ai-extract-sources";
import { trpcClient } from "@/utils/trpc";

export type SessionParam =
	| { liveCashGameSessionId: string; liveTournamentSessionId?: never }
	| { liveCashGameSessionId?: never; liveTournamentSessionId: string };

export type Step = "select-app" | "upload" | "review";

export type RowAction = "existing" | "new" | "hero" | "skip";

export interface PlayerOption {
	id: string;
	name: string;
}

export interface ReviewRow {
	action: RowAction;
	ambiguous: boolean;
	existingPlayerId: string | null;
	isHeroCandidate: boolean;
	matchedPlayerName: string | null;
	name: string;
	rowId: string;
	seatNumber: number;
	seatPosition: number;
	warning: string | null;
}

export const ACCEPTED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;
export type AcceptedMediaType = (typeof ACCEPTED_TYPES)[number];

export const SOURCE_APP_ENTRIES = Object.entries(TABLE_PLAYER_SOURCE_APPS) as [
	TablePlayerSourceApp,
	(typeof TABLE_PLAYER_SOURCE_APPS)[TablePlayerSourceApp],
][];

export function isAcceptedMediaType(type: string): type is AcceptedMediaType {
	return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			resolve(result.split(",")[1] ?? "");
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

export function applyRowAction(
	row: ReviewRow,
	targetRowId: string,
	nextAction: RowAction
): ReviewRow {
	if (row.rowId !== targetRowId) {
		if (nextAction === "hero" && row.action === "hero") {
			return {
				...row,
				action: row.existingPlayerId ? "existing" : "new",
			};
		}
		return row;
	}
	if (row.ambiguous && nextAction === "existing") {
		return row;
	}
	return { ...row, action: nextAction };
}

export function updateHeroSeatViaClient(
	sessionParam: SessionParam,
	heroSeatPosition: number | null
): Promise<unknown> {
	if (sessionParam.liveCashGameSessionId !== undefined) {
		return trpcClient.liveCashGameSession.updateHeroSeat.mutate({
			id: sessionParam.liveCashGameSessionId,
			heroSeatPosition,
		});
	}
	if (sessionParam.liveTournamentSessionId !== undefined) {
		return trpcClient.liveTournamentSession.updateHeroSeat.mutate({
			id: sessionParam.liveTournamentSessionId,
			heroSeatPosition,
		});
	}
	throw new Error("Invalid sessionParam: neither cash game nor tournament");
}

export async function applyRow(
	row: ReviewRow,
	sessionParam: SessionParam
): Promise<boolean> {
	try {
		if (row.action === "hero") {
			await updateHeroSeatViaClient(sessionParam, row.seatPosition);
		} else if (row.action === "existing" && row.existingPlayerId) {
			await trpcClient.sessionTablePlayer.add.mutate({
				...sessionParam,
				playerId: row.existingPlayerId,
				seatPosition: row.seatPosition,
			});
		} else if (row.action === "new") {
			await trpcClient.sessionTablePlayer.addNew.mutate({
				...sessionParam,
				playerName: row.name.trim(),
				seatPosition: row.seatPosition,
			});
		}
		return true;
	} catch {
		return false;
	}
}

export function computeRowWarning({
	action,
	occupiedSeatPositions,
	seatNumber,
	seatPosition,
}: {
	action: RowAction;
	occupiedSeatPositions: Set<number>;
	seatNumber: number;
	seatPosition: number;
}): string | null {
	if (seatPosition < 0 || seatPosition > 8) {
		return `Seat ${seatNumber} is out of range (1-9).`;
	}
	if (
		action !== "hero" &&
		action !== "skip" &&
		occupiedSeatPositions.has(seatPosition)
	) {
		return `Seat ${seatNumber} is already occupied.`;
	}
	return null;
}

export function computeRowAction({
	effectivePreferredAction,
	isHeroCandidate,
	matchedPlayer,
	trimmedName,
}: {
	effectivePreferredAction: RowAction | undefined;
	isHeroCandidate: boolean;
	matchedPlayer: { id: string; name: string } | null;
	trimmedName: string;
}): RowAction {
	if (effectivePreferredAction) {
		if (effectivePreferredAction === "existing" && !matchedPlayer) {
			return "new";
		}
		if (effectivePreferredAction === "new" && trimmedName === "") {
			return "skip";
		}
		return effectivePreferredAction;
	}
	if (isHeroCandidate) {
		return "hero";
	}
	if (trimmedName === "") {
		return "skip";
	}
	if (matchedPlayer) {
		return "existing";
	}
	return "new";
}

export function buildRow({
	isHero,
	name,
	occupiedSeatPositions,
	playersByNormalizedName,
	preferredAction,
	seatNumber,
	seatPosition,
}: {
	isHero: boolean;
	name: string;
	occupiedSeatPositions: Set<number>;
	playersByNormalizedName: Map<
		string,
		{ id: string; name: string; count: number }[]
	>;
	preferredAction?: RowAction;
	seatNumber: number;
	seatPosition: number;
}): ReviewRow {
	const rowId = `seat-${seatNumber}`;
	const trimmedName = name.trim();
	const key = normalizeName(trimmedName);
	const matches = trimmedName ? (playersByNormalizedName.get(key) ?? []) : [];
	const ambiguous = matches.length > 1;
	const matchedPlayer = matches.length === 1 ? matches[0] : null;
	const isHeroCandidate = isHero;

	const effectivePreferredAction = preferredAction;

	const action = computeRowAction({
		effectivePreferredAction,
		isHeroCandidate,
		matchedPlayer,
		trimmedName,
	});
	const warning = computeRowWarning({
		action,
		occupiedSeatPositions,
		seatNumber,
		seatPosition,
	});

	return {
		action,
		ambiguous,
		existingPlayerId: matchedPlayer?.id ?? null,
		isHeroCandidate,
		matchedPlayerName: matchedPlayer?.name ?? null,
		name: trimmedName,
		rowId,
		seatNumber,
		seatPosition,
		warning,
	};
}
