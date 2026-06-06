import { formatCompactNumber, formatYmdSlash } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";

/**
 * Pure presentational helpers shared by the v2 sessions list card and the
 * session detail page. Kept framework-free so they live in the `web-node`
 * test project.
 */

export interface StatRow {
	label: string;
	value: string;
}

interface GameNameInput {
	ringGameName: string | null;
	tournamentName: string | null;
	type: string;
}

/**
 * Resolves the display name for a session, preferring the frozen rule name and
 * falling back to a generic label per game type. Sentence case per the v2
 * design contract.
 */
export function getSessionGameName(session: GameNameInput): string {
	if (session.type === "tournament" && session.tournamentName) {
		return session.tournamentName;
	}
	if (session.type === "cash_game" && session.ringGameName) {
		return session.ringGameName;
	}
	return session.type === "tournament" ? "Tournament" : "Cash game";
}

/** True when the session was recorded through the live tracker. */
export function isLiveSession(session: { source: string }): boolean {
	return session.source === "live";
}

/**
 * Net played duration as a `Nh` string (break minutes subtracted). Returns
 * `null` when either bound is missing so callers can omit the row entirely.
 */
export function formatSessionDuration(
	startedAt: string | null,
	endedAt: string | null,
	breakMinutes?: number | null
): string | null {
	if (!(startedAt && endedAt)) {
		return null;
	}
	const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
	const breakMs = (breakMinutes ?? 0) * 60 * 1000;
	const hours = (diffMs - breakMs) / (1000 * 60 * 60);
	return `${hours.toFixed(1)}h`;
}

interface CashStatInput {
	buyIn: number | null;
	cashOut: number | null;
	evCashOut: number | null;
	evProfitLoss: number | null;
}

/**
 * Financial rows for a cash-game session detail. Each amount is omitted when
 * its source value is `null`, so the detail card never renders an empty row.
 */
export function buildCashStatRows(session: CashStatInput): StatRow[] {
	const rows: StatRow[] = [];
	if (session.buyIn !== null) {
		rows.push({ label: "Buy-in", value: formatCompactNumber(session.buyIn) });
	}
	if (session.cashOut !== null) {
		rows.push({
			label: "Cash-out",
			value: formatCompactNumber(session.cashOut),
		});
	}
	if (session.evCashOut !== null) {
		rows.push({
			label: "EV cash-out",
			value: formatCompactNumber(session.evCashOut),
		});
	}
	if (session.evProfitLoss !== null) {
		rows.push({
			label: "EV P&L",
			value: formatProfitLoss(session.evProfitLoss),
		});
	}
	return rows;
}

interface TournamentStatInput {
	bountyPrizes: number | null;
	chipPurchases: Array<{
		cost: number;
		count: number;
		id: string;
		name: string;
	}>;
	entryFee: number | null;
	placement: number | null;
	prizeMoney: number | null;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
}

/**
 * Financial + result rows for a tournament session detail. Zero-valued fees /
 * prizes are treated as "not applicable" and dropped; chip purchases only
 * appear when at least one was bought.
 */
export function buildTournamentStatRows(
	session: TournamentStatInput
): StatRow[] {
	const rows: StatRow[] = [];
	if (session.tournamentBuyIn !== null) {
		rows.push({
			label: "Buy-in",
			value: formatCompactNumber(session.tournamentBuyIn),
		});
	}
	if (session.entryFee !== null && session.entryFee > 0) {
		rows.push({
			label: "Entry fee",
			value: formatCompactNumber(session.entryFee),
		});
	}
	if (session.prizeMoney !== null && session.prizeMoney > 0) {
		rows.push({
			label: "Prize",
			value: formatCompactNumber(session.prizeMoney),
		});
	}
	if (session.bountyPrizes !== null && session.bountyPrizes > 0) {
		rows.push({
			label: "Bounty",
			value: formatCompactNumber(session.bountyPrizes),
		});
	}
	for (const cp of session.chipPurchases) {
		if (cp.count > 0) {
			rows.push({
				label: cp.name || "Chip purchase",
				value: `${cp.count} × ${formatCompactNumber(cp.cost)}`,
			});
		}
	}
	if (session.placement !== null) {
		rows.push({
			label: "Placement",
			value:
				session.totalEntries === null
					? `${session.placement}`
					: `${session.placement} / ${session.totalEntries}`,
		});
	}
	return rows;
}

interface MetaInput {
	breakMinutes: number | null;
	currencyName: string | null;
	endedAt: string | null;
	roomName: string | null;
	sessionDate: string;
	startedAt: string | null;
}

/**
 * Meta rows (when, where, currency, played duration) shared by both the manual
 * and live detail views. The date is always present; the rest are conditional.
 */
export function buildSessionMetaRows(session: MetaInput): StatRow[] {
	const rows: StatRow[] = [
		{ label: "Date", value: formatYmdSlash(session.sessionDate) },
	];
	if (session.roomName) {
		rows.push({ label: "Room", value: session.roomName });
	}
	if (session.currencyName) {
		rows.push({ label: "Currency", value: session.currencyName });
	}
	const duration = formatSessionDuration(
		session.startedAt,
		session.endedAt,
		session.breakMinutes
	);
	if (duration !== null) {
		rows.push({ label: "Duration", value: duration });
	}
	return rows;
}
