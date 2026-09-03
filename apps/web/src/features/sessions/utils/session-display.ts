import {
	formatAnteSuffix,
	formatBlindParts,
	formatGroupStakes,
	type GameGroupLike,
	groupDisplayLabel,
	variantLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
import { formatCompactNumber, formatYmdSlash } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";

export interface StatRow {
	label: string;
	value: string;
}

interface GameNameInput {
	ringGameName: string | null;
	tournamentName: string | null;
	type: string;
}

export function getSessionGameName(session: GameNameInput): string {
	if (session.type === "tournament" && session.tournamentName) {
		return session.tournamentName;
	}
	if (session.type === "cash_game" && session.ringGameName) {
		return session.ringGameName;
	}
	return session.type === "tournament" ? "Tournament" : "Cash game";
}

export function isLiveSession(session: { source: string }): boolean {
	return session.source === "live";
}

export function formatSessionDuration(
	startedAt: string | null,
	endedAt: string | null,
	breakMinutes?: number | null
): string | null {
	if (!(startedAt && endedAt)) {
		return null;
	}
	const startedMs = new Date(startedAt).getTime();
	const endedMs = new Date(endedAt).getTime();
	if (!(Number.isFinite(startedMs) && Number.isFinite(endedMs))) {
		return null;
	}
	let diffMs = endedMs - startedMs;
	if (diffMs < 0) {
		diffMs += 24 * 60 * 60 * 1000;
	}
	const breakMs = (breakMinutes ?? 0) * 60 * 1000;
	const playedMs = diffMs - breakMs;
	if (playedMs < 0) {
		return null;
	}
	const hours = playedMs / (1000 * 60 * 60);
	return `${hours.toFixed(1)}h`;
}

interface CashRuleInput {
	cashAnte: number | null;
	cashAnteType: string | null;
	cashBlind1: number | null;
	cashBlind3: number | null;
	cashMixGames?: GameGroupLike[] | null;
	cashTableSize: number | null;
	cashVariant: string | null;
	ringGameBlind2: number | null;
}

export function buildCashRuleRows(session: CashRuleInput): StatRow[] {
	const rows: StatRow[] = [];
	if (session.cashVariant) {
		rows.push({ label: "Variant", value: variantLabel(session.cashVariant) });
	}
	if (session.cashMixGames && session.cashMixGames.length > 0) {
		for (const group of session.cashMixGames) {
			rows.push({
				label: groupDisplayLabel(group),
				value: formatGroupStakes(group),
			});
		}
		if (session.cashTableSize != null) {
			rows.push({ label: "Table", value: `${session.cashTableSize}-max` });
		}
		return rows;
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

export function formatSessionPlDisplay(
	session: PlDisplayInput,
	bbBiMode: boolean
): string {
	return formatPlValue(session.profitLoss ?? 0, session, bbBiMode);
}

interface EvDisplayInput extends PlDisplayInput {
	evCashOut: number | null;
	evProfitLoss: number | null;
}

export function displayableEvProfitLoss(session: {
	evCashOut: number | null;
	evProfitLoss: number | null;
	type: string;
}): number | null {
	if (session.type !== "cash_game" || session.evCashOut === null) {
		return null;
	}
	return session.evProfitLoss;
}

export function formatSessionEvDisplay(
	session: EvDisplayInput,
	bbBiMode: boolean
): string | null {
	const evProfitLoss = displayableEvProfitLoss(session);
	if (evProfitLoss === null) {
		return null;
	}
	return formatPlValue(Math.round(evProfitLoss), session, bbBiMode);
}
