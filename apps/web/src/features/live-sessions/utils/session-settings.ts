import { formatNumber } from "@/utils/format-number";

const SYMBOL_UNIT_LENGTH = 1;

export interface CurrencyLike {
	id: string;
	name: string;
	unit: string | null;
}

export interface SessionTagLike {
	id: string;
	name: string;
	usageCount: number;
}

export function formatWithUnit(
	amount: number,
	unit: string | null | undefined
): string {
	const body = formatNumber(amount);
	if (!unit) {
		return body;
	}
	return unit.length === SYMBOL_UNIT_LENGTH
		? `${unit}${body}`
		: `${body} ${unit}`;
}

export function currencyRowLabel(currency: CurrencyLike | null): string {
	if (currency === null) {
		return "Not set";
	}
	return currency.unit ? `${currency.unit} ${currency.name}` : currency.name;
}

export function findCurrency<T extends CurrencyLike>(
	currencies: readonly T[],
	currencyId: string
): T | null {
	return currencies.find((currency) => currency.id === currencyId) ?? null;
}

export interface MasterLinkCopy {
	action: string;
	subtitle: string;
	title: string;
}

export function describeMasterLink(
	linkedName: string | null,
	sessionType: "cash_game" | "tournament"
): MasterLinkCopy {
	if (linkedName !== null) {
		return {
			action: "Change",
			subtitle: "Results from this session roll up into the master.",
			title: linkedName,
		};
	}
	const kind = sessionType === "tournament" ? "tournament" : "ring game";
	return {
		action: "Link",
		subtitle: "Stats stay session-only until you link or create a master.",
		title: `Not linked to a ${kind}`,
	};
}

export type MasterFieldKey =
	| "ante"
	| "anteType"
	| "blind1"
	| "blind2"
	| "blind3"
	| "bountyAmount"
	| "currencyId"
	| "entryFee"
	| "maxBuyIn"
	| "minBuyIn"
	| "ruleName"
	| "startingStack"
	| "tableSize"
	| "tournamentBuyIn";

export type MasterFieldValues = Partial<Record<MasterFieldKey, string>>;

export interface CashMasterLike {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	currencyId: string | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	name: string;
	tableSize: number | null;
}

export interface TournamentMasterLike {
	bountyAmount: number | null;
	buyIn: number | null;
	currencyId: string | null;
	entryFee: number | null;
	name: string;
	startingStack: number | null;
	tableSize: number | null;
}

function numberText(value: number | null): string {
	return value === null ? "" : String(value);
}

export function describeCashMasterValues(
	master: CashMasterLike | null
): MasterFieldValues | null {
	if (master === null) {
		return null;
	}
	return {
		ante: numberText(master.ante),
		anteType: master.anteType ?? "none",
		blind1: numberText(master.blind1),
		blind2: numberText(master.blind2),
		blind3: numberText(master.blind3),
		currencyId: master.currencyId ?? "",
		maxBuyIn: numberText(master.maxBuyIn),
		minBuyIn: numberText(master.minBuyIn),
		ruleName: master.name,
		tableSize: numberText(master.tableSize),
	};
}

export function describeTournamentMasterValues(
	master: TournamentMasterLike | null
): MasterFieldValues | null {
	if (master === null) {
		return null;
	}
	return {
		bountyAmount: numberText(master.bountyAmount),
		currencyId: master.currencyId ?? "",
		entryFee: numberText(master.entryFee),
		ruleName: master.name,
		startingStack: numberText(master.startingStack),
		tableSize: numberText(master.tableSize),
		tournamentBuyIn: numberText(master.buyIn),
	};
}

export function isMasterFieldDifferent(
	master: MasterFieldValues | null,
	key: MasterFieldKey,
	currentValue: string
): boolean {
	if (master === null) {
		return false;
	}
	const masterValue = master[key];
	return masterValue !== undefined && masterValue !== currentValue;
}
