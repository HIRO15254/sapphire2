import { variantDisplayLabel } from "@sapphire2/db/constants/game-variants";
import type { LevelGameGroup, MixGameGroup } from "@sapphire2/db/schemas/game";
import { formatBlindParts } from "@/features/live-sessions/utils/game-scene-formatters";
import { countGames } from "@/features/live-sessions/utils/mix-composition";
import {
	formatWithUnit,
	type LinkedMasterSummary,
	type MasterFieldKey,
	type MasterFieldValues,
} from "@/features/live-sessions/utils/session-settings";
import { formatNumber } from "@/utils/format-number";

export type MasterNoun = "ring game" | "tournament";

export function masterNounFor(
	sessionType: "cash_game" | "tournament"
): MasterNoun {
	return sessionType === "tournament" ? "tournament" : "ring game";
}

export interface CashMasterMetaSource {
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	mixGames: MixGameGroup[] | null;
	tableSize: number | null;
	variant: string;
}

export interface TournamentMasterMetaSource {
	buyIn: number | null;
	entryFee: number | null;
	startingStack: number | null;
	tableSize: number | null;
}

function tableSizeText(tableSize: number | null): string | null {
	return tableSize === null ? null : `${tableSize}-max`;
}

function buyInRangeText(min: number | null, max: number | null): string | null {
	if (min !== null && max !== null) {
		return min === max
			? `buy-in ${formatNumber(min)}`
			: `buy-in ${formatNumber(min)}–${formatNumber(max)}`;
	}
	const only = min ?? max;
	return only === null ? null : `buy-in ${formatNumber(only)}`;
}

function joinMeta(parts: readonly (string | null)[]): string {
	return parts.filter((part): part is string => !!part).join(" · ");
}

function stakesText(blinds: {
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
}): string {
	return formatBlindParts({
		ante: null,
		blind1: blinds.blind1 ?? null,
		blind2: blinds.blind2 ?? null,
		blind3: blinds.blind3 ?? null,
	});
}

function mixStakesText(groups: readonly MixGameGroup[]): string {
	return [...new Set(groups.map(stakesText).filter(Boolean))].join(", ");
}

export function describeCashMasterMeta(master: CashMasterMetaSource): string {
	const groups = master.mixGames ?? [];
	return joinMeta([
		groups.length > 0 ? variantDisplayLabel(master.variant) : null,
		groups.length > 0 ? mixStakesText(groups) : stakesText(master),
		buyInRangeText(master.minBuyIn, master.maxBuyIn),
		tableSizeText(master.tableSize),
	]);
}

export function describeTournamentMasterMeta(
	master: TournamentMasterMetaSource
): string {
	let buyIn: string | null = null;
	if (master.buyIn !== null) {
		buyIn =
			master.entryFee === null
				? formatNumber(master.buyIn)
				: `${formatNumber(master.buyIn)} + ${formatNumber(master.entryFee)}`;
	}
	return joinMeta([
		buyIn,
		master.startingStack === null
			? null
			: `${formatNumber(master.startingStack)} chips`,
		tableSizeText(master.tableSize),
	]);
}

export function withRoomName(roomName: string | null, meta: string): string {
	return joinMeta([roomName, meta]);
}

export interface LinkedMasterRows {
	ringGame: (CashMasterMetaSource & { name: string }) | null;
	tournament: (TournamentMasterMetaSource & { name: string }) | null;
}

function describeLinkedRow({
	ringGame,
	tournament,
}: LinkedMasterRows): LinkedMasterSummary | null {
	if (ringGame !== null) {
		return { meta: describeCashMasterMeta(ringGame), name: ringGame.name };
	}
	if (tournament !== null) {
		return {
			meta: describeTournamentMasterMeta(tournament),
			name: tournament.name,
		};
	}
	return null;
}

export function summarizeLinkedMaster(
	rows: LinkedMasterRows,
	roomName: string | null,
	noun: MasterNoun
): LinkedMasterSummary {
	const row = describeLinkedRow(rows);
	return {
		meta: withRoomName(roomName, row?.meta ?? ""),
		name: row?.name ?? `Linked ${noun}`,
	};
}

export interface SnapshotRow {
	isMono: boolean;
	label: string;
	value: string;
}

export interface SnapshotRowsSource {
	blindLabels: { blind1: string; blind2: string };
	blindLevelCount: number;
	currencyName: string | null;
	currencyUnit: string | null;
	isMix: boolean;
	mixGames: readonly MixGameGroup[];
	numbers: {
		blind1: number | null;
		blind2: number | null;
		entryFee: number | null;
		maxBuyIn: number | null;
		minBuyIn: number | null;
		startingStack: number | null;
		tournamentBuyIn: number | null;
	};
	sessionType: "cash_game" | "tournament";
	tableSize: number | null;
	variant: string;
}

const EMPTY_VALUE = "—";

function plural(count: number, noun: string): string {
	return `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function gameTypeText(source: SnapshotRowsSource): string {
	if (source.isMix) {
		return `${variantDisplayLabel(source.variant)} · ${plural(countGames(source.mixGames), "game")}`;
	}
	return source.variant.trim() === "" ? "Not set" : source.variant;
}

function currencyText(name: string | null, unit: string | null): string {
	if (name === null) {
		return "Not set";
	}
	return unit ? `${name} · ${unit}` : name;
}

export function describeSnapshotRows(
	source: SnapshotRowsSource
): SnapshotRow[] {
	const { numbers } = source;
	const money = (amount: number | null) =>
		amount === null ? EMPTY_VALUE : formatWithUnit(amount, source.currencyUnit);
	const gameType = {
		isMono: false,
		label: "Game type",
		value: gameTypeText(source),
	};
	const currency = {
		isMono: false,
		label: "Currency",
		value: currencyText(source.currencyName, source.currencyUnit),
	};

	if (source.sessionType === "tournament") {
		let buyIn = EMPTY_VALUE;
		if (numbers.tournamentBuyIn !== null) {
			buyIn =
				numbers.entryFee === null
					? money(numbers.tournamentBuyIn)
					: `${money(numbers.tournamentBuyIn)} + ${money(numbers.entryFee)}`;
		}
		return [
			gameType,
			{ isMono: true, label: "Buy-in", value: buyIn },
			{
				isMono: true,
				label: "Starting stack",
				value:
					numbers.startingStack === null
						? EMPTY_VALUE
						: `${formatNumber(numbers.startingStack)} chips`,
			},
			{
				isMono: true,
				label: "Levels",
				value: plural(source.blindLevelCount, "level"),
			},
			currency,
		];
	}

	let buyIn = EMPTY_VALUE;
	if (numbers.minBuyIn !== null && numbers.maxBuyIn !== null) {
		buyIn = `${money(numbers.minBuyIn)} – ${money(numbers.maxBuyIn)}`;
	} else if (numbers.minBuyIn !== null || numbers.maxBuyIn !== null) {
		buyIn = money(numbers.minBuyIn ?? numbers.maxBuyIn);
	}
	let stakes = EMPTY_VALUE;
	if (source.isMix) {
		stakes = mixStakesText(source.mixGames) || EMPTY_VALUE;
	} else if (numbers.blind1 !== null || numbers.blind2 !== null) {
		stakes = `${money(numbers.blind1)} / ${money(numbers.blind2)}`;
	}
	return [
		gameType,
		{
			isMono: true,
			label: source.isMix
				? "Stakes"
				: `${source.blindLabels.blind1} / ${source.blindLabels.blind2}`,
			value: stakes,
		},
		{ isMono: true, label: "Buy-in", value: buyIn },
		{
			isMono: true,
			label: "Table size",
			value: tableSizeText(source.tableSize) ?? EMPTY_VALUE,
		},
		currency,
	];
}

const NON_RULE_KEYS: readonly MasterFieldKey[] = ["currencyId", "ruleName"];

export function hasSameRules(
	master: MasterFieldValues | null,
	session: MasterFieldValues | null
): boolean {
	if (master === null || session === null) {
		return false;
	}
	return (Object.keys(master) as MasterFieldKey[])
		.filter((key) => !NON_RULE_KEYS.includes(key))
		.every((key) => master[key] === (session[key] ?? ""));
}

export interface CashRuleSnapshot {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	mixGames: MixGameGroup[] | null;
	tableSize: number | null;
	variant: string;
}

export interface TournamentRuleSnapshot {
	bountyAmount: number | null;
	buyIn: number | null;
	entryFee: number | null;
	startingStack: number | null;
	tableSize: number | null;
	variant: string;
}

export interface SnapshotBlindLevel {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	games?: LevelGameGroup[] | null;
	isBreak: boolean;
	minutes: number | null;
}

export interface SnapshotChipPurchase {
	chips: number;
	cost: number;
	name: string;
}

interface MasterTarget {
	currencyId: string | null;
	name: string;
	roomId: string;
}

function definedOnly<T extends Record<string, unknown>>(
	record: T
): { [K in keyof T]?: Exclude<T[K], null> } {
	return Object.fromEntries(
		Object.entries(record).filter(([, value]) => value !== null)
	) as { [K in keyof T]?: Exclude<T[K], null> };
}

const ANTE_TYPES = ["all", "bb", "none"] as const;

function toAnteType(value: string | null): (typeof ANTE_TYPES)[number] | null {
	return ANTE_TYPES.find((candidate) => candidate === value) ?? null;
}

export function buildRingGameCreateInput(
	target: MasterTarget,
	snapshot: CashRuleSnapshot
) {
	return {
		...definedOnly({
			ante: snapshot.ante,
			anteType: toAnteType(snapshot.anteType),
			blind1: snapshot.blind1,
			blind2: snapshot.blind2,
			blind3: snapshot.blind3,
			currencyId: target.currencyId,
			maxBuyIn: snapshot.maxBuyIn,
			minBuyIn: snapshot.minBuyIn,
			tableSize: snapshot.tableSize,
		}),
		mixGames: snapshot.mixGames,
		name: target.name.trim(),
		roomId: target.roomId,
		variant: snapshot.variant,
	};
}

export function buildTournamentCreateInput(
	target: MasterTarget,
	snapshot: TournamentRuleSnapshot,
	blindLevels: readonly SnapshotBlindLevel[],
	chipPurchases: readonly SnapshotChipPurchase[]
) {
	return {
		...definedOnly({
			bountyAmount: snapshot.bountyAmount,
			buyIn: snapshot.buyIn,
			currencyId: target.currencyId,
			entryFee: snapshot.entryFee,
			startingStack: snapshot.startingStack,
			tableSize: snapshot.tableSize,
		}),
		blindLevels: blindLevels.map((level) => ({
			ante: level.ante,
			blind1: level.blind1,
			blind2: level.blind2,
			blind3: level.blind3,
			games: level.games ?? null,
			isBreak: level.isBreak,
			minutes: level.minutes,
		})),
		chipPurchases: chipPurchases.map(({ chips, cost, name }) => ({
			chips,
			cost,
			name,
		})),
		name: target.name.trim(),
		roomId: target.roomId,
		variant: snapshot.variant,
	};
}
