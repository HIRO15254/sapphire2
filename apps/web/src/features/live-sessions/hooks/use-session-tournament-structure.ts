import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export interface SessionBlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	/** Per-level game groups for mix tournaments; null = single structure. */
	games: LevelGameGroup[] | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
}

export interface SessionChipPurchaseRow {
	chips: number;
	cost: number;
	id: string;
	name: string;
	sortOrder: number;
}

export interface SessionTournamentDisplay {
	bountyAmount: number | null;
	buyIn: number | null;
	entryFee: number | null;
	ruleName: string;
	startingStack: number | null;
	tableSize: number | null;
	variant: string;
}

/**
 * Read tournament rule data frozen onto the session. This replaces
 * `useTournamentDetail` for live-session display contexts: the values come
 * from the snapshot tables (`session_blind_level`, `session_chip_purchase`)
 * and snapshot columns on `session_tournament_detail`. They are stable even
 * if the parent tournament is renamed or its blind structure is edited.
 */
export function useSessionTournamentStructure(sessionId: string) {
	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});

	const data = sessionQuery.data;
	const blindLevels: SessionBlindLevelRow[] = (data?.blindLevels ?? []).map(
		(l) => ({
			id: l.id,
			level: l.level,
			isBreak: l.isBreak,
			games: l.games ?? null,
			blind1: l.blind1,
			blind2: l.blind2,
			blind3: l.blind3,
			ante: l.ante,
			minutes: l.minutes,
		})
	);
	const chipPurchases: SessionChipPurchaseRow[] = (
		data?.chipPurchases ?? []
	).map((p) => ({
		id: p.id,
		name: p.name,
		cost: p.cost,
		chips: p.chips,
		sortOrder: p.sortOrder,
	}));

	const display: SessionTournamentDisplay | null =
		data && data.ruleName !== null && data.variant !== null
			? {
					ruleName: data.ruleName,
					variant: data.variant,
					buyIn: data.buyIn,
					entryFee: data.entryFee,
					startingStack: data.startingStack,
					bountyAmount: data.bountyAmount,
					tableSize: data.tableSize,
				}
			: null;

	return {
		isLoading: sessionQuery.isLoading,
		display,
		blindLevels,
		chipPurchases,
	};
}
