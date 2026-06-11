import {
	formatAnteSuffix,
	formatBlindParts,
	variantLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
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

interface CashRuleInput {
	cashAnte: number | null;
	cashAnteType: string | null;
	cashBlind1: number | null;
	cashBlind3: number | null;
	cashTableSize: number | null;
	cashVariant: string | null;
	ringGameBlind2: number | null;
}

/**
 * Game-rule rows for a cash-game session detail (the "Rule" section): variant,
 * blinds (+ ante), and table size. Each row is omitted when its source value is
 * absent, so the section never shows an empty row (and is dropped entirely when
 * no rule data was recorded).
 */
export function buildCashRuleRows(session: CashRuleInput): StatRow[] {
	const rows: StatRow[] = [];
	if (session.cashVariant) {
		rows.push({ label: "Variant", value: variantLabel(session.cashVariant) });
	}
	const blinds = formatBlindParts({
		ante: session.cashAnte,
		anteType: session.cashAnteType,
		blind1: session.cashBlind1,
		blind2: session.ringGameBlind2,
		blind3: session.cashBlind3,
	});
	if (blinds) {
		const ante = formatAnteSuffix({
			ante: session.cashAnte,
			anteType: session.cashAnteType,
			blind1: session.cashBlind1,
			blind2: session.ringGameBlind2,
			blind3: session.cashBlind3,
		});
		rows.push({ label: "Blinds", value: ante ? `${blinds} ${ante}` : blinds });
	}
	if (session.cashTableSize != null) {
		rows.push({ label: "Table", value: `${session.cashTableSize}-max` });
	}
	return rows;
}

interface CashStatInput {
	buyIn: number | null;
	cashOut: number | null;
}

/**
 * Result rows for a cash-game session detail (the "Result" section): the
 * recorded buy-in and cash-out. EV figures live in the P&L hero card, not here.
 * Each amount is omitted when its source value is `null`.
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
	return rows;
}

interface TournamentRuleInput {
	entryFee: number | null;
	tournamentBuyIn: number | null;
	tournamentStartingStack: number | null;
	tournamentTableSize: number | null;
	tournamentVariant: string | null;
}

/**
 * Game-rule rows for a tournament session detail (the "Rule" section): variant,
 * buy-in / entry fee, starting stack, and table size. Zero-valued entry fee is
 * dropped; other rows are omitted when absent.
 */
export function buildTournamentRuleRows(
	session: TournamentRuleInput
): StatRow[] {
	const rows: StatRow[] = [];
	if (session.tournamentVariant) {
		rows.push({
			label: "Variant",
			value: variantLabel(session.tournamentVariant),
		});
	}
	if (session.tournamentBuyIn != null) {
		rows.push({
			label: "Buy-in",
			value: formatCompactNumber(session.tournamentBuyIn),
		});
	}
	if (session.entryFee != null && session.entryFee > 0) {
		rows.push({
			label: "Entry fee",
			value: formatCompactNumber(session.entryFee),
		});
	}
	if (session.tournamentStartingStack != null) {
		rows.push({
			label: "Starting stack",
			value: formatCompactNumber(session.tournamentStartingStack),
		});
	}
	if (session.tournamentTableSize != null) {
		rows.push({ label: "Table", value: `${session.tournamentTableSize}-max` });
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
	placement: number | null;
	prizeMoney: number | null;
	totalEntries: number | null;
}

/**
 * Result rows for a tournament session detail (the "Result" section): prize,
 * bounty, chip purchases (re-entries / add-ons), and the final placement.
 * Buy-in / entry fee are game-rule data and live in {@link buildTournamentRuleRows}.
 * Zero-valued prizes are dropped; chip purchases only appear when at least one
 * was bought.
 */
export function buildTournamentStatRows(
	session: TournamentStatInput
): StatRow[] {
	const rows: StatRow[] = [];
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

interface TournamentResultInput {
	placement: number | null;
	totalEntries: number | null;
	type: string;
}

/**
 * Secondary result line for a tournament list row: placement over total
 * entries (e.g. "3 / 120"), or a bare placement when the field size is
 * unknown. Returns `null` for cash games or unrecorded placements so the card
 * omits the second result line entirely.
 */
export function formatTournamentResult(
	session: TournamentResultInput
): string | null {
	if (session.type !== "tournament" || session.placement === null) {
		return null;
	}
	return session.totalEntries === null
		? `${session.placement}`
		: `${session.placement} / ${session.totalEntries}`;
}

interface PlDisplayInput {
	chipPurchaseCost: number;
	currencyUnit: string | null;
	entryFee: number | null;
	profitLoss: number | null;
	ringGameBlind2: number | null;
	tournamentBuyIn: number | null;
	type: string;
}

function toBB(value: number, blind2: number | null): number | null {
	if (blind2 === null || blind2 === 0) {
		return null;
	}
	return value / blind2;
}

/** Total tournament cost (buy-in + entry fee + chip purchases) used as the BI base. */
function computeTotalCost(session: PlDisplayInput): number {
	return (
		(session.tournamentBuyIn ?? 0) +
		(session.entryFee ?? 0) +
		session.chipPurchaseCost
	);
}

function toBI(profitLoss: number, totalCost: number): number | null {
	if (totalCost === 0) {
		return null;
	}
	return profitLoss / totalCost;
}

function formatBBBI(value: number, unit: "BB" | "BI"): string {
	const decimals = unit === "BI" ? 2 : 1;
	return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)} ${unit}`;
}

/**
 * Core value formatter honoring the BB/BI toggle, shared by the realized P&L
 * and the EV figure. When off, the raw currency amount is shown. When on, cash
 * games render in big blinds (value ÷ BB) and tournaments in buy-ins (value ÷
 * total cost); either falls back to the currency figure when the divisor is
 * unavailable.
 */
function formatPlValue(
	value: number,
	session: PlDisplayInput,
	bbBiMode: boolean
): string {
	const currency = formatProfitLoss(value, {
		currencyUnit: session.currencyUnit,
	});
	if (!bbBiMode) {
		return currency;
	}
	if (session.type === "tournament") {
		const bi = toBI(value, computeTotalCost(session));
		return bi === null ? currency : formatBBBI(bi, "BI");
	}
	const bb = toBB(value, session.ringGameBlind2);
	return bb === null ? currency : formatBBBI(bb, "BB");
}

/** Realized P&L display string honoring the BB/BI toggle. */
export function formatSessionPlDisplay(
	session: PlDisplayInput,
	bbBiMode: boolean
): string {
	return formatPlValue(session.profitLoss ?? 0, session, bbBiMode);
}

interface EvDisplayInput extends PlDisplayInput {
	evProfitLoss: number | null;
}

/**
 * Secondary EV figure for a cash-game list row, honoring the BB/BI toggle.
 * Returns `null` for tournaments or when no EV cash-out was recorded, so the
 * result section omits the second line. Live cash games carry an EV P&L; manual
 * entries only have one when the user logged an EV cash-out.
 *
 * The realized P&L is always whole chips, but the EV can be fractional (live
 * all-in equity), so the value is rounded to the nearest integer before
 * formatting — that keeps the EV's displayed precision aligned with the P&L's
 * in the card. In BB/BI mode both figures already share a fixed decimal count.
 */
export function formatSessionEvDisplay(
	session: EvDisplayInput,
	bbBiMode: boolean
): string | null {
	if (session.type !== "cash_game" || session.evProfitLoss === null) {
		return null;
	}
	return formatPlValue(Math.round(session.evProfitLoss), session, bbBiMode);
}
