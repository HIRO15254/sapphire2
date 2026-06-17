import z from "zod";
import { optionalNumericString } from "@/shared/lib/form-fields";

export interface SessionBlindLevelInput {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	isBreak: boolean;
	minutes: number | null;
}

export interface SessionChipPurchaseInput {
	chips: number;
	cost: number;
	/** How many times this chip purchase was bought (the session result). */
	count: number;
	name: string;
}

export interface CashGameFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	breakMinutes?: number;
	buyIn: number;
	cashOut: number;
	currencyId?: string;
	endTime?: string;
	evCashOut?: number;
	maxBuyIn?: number;
	memo?: string;
	minBuyIn?: number;
	ringGameId?: string;
	roomId?: string;
	ruleName?: string;
	sessionDate: string;
	startTime?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

export interface TournamentFormValues {
	beforeDeadline?: boolean;
	blindLevels?: SessionBlindLevelInput[];
	bountyAmount?: number;
	bountyPrizes?: number;
	breakMinutes?: number;
	chipPurchases?: SessionChipPurchaseInput[];
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	/** Promoted prior-day session this live session continues from. */
	previousSessionId?: string;
	prizeMoney?: number;
	roomId?: string;
	ruleName?: string;
	sessionDate: string;
	startingStack?: number;
	startTime?: string;
	tableSize?: number;
	tagIds?: string[];
	/** Unix seconds — when the blind timer started. */
	timerStartedAt?: number;
	totalEntries?: number;
	tournamentBuyIn: number;
	tournamentId?: string;
	type: "tournament";
	variant?: string;
}

export type SessionFormValues = CashGameFormValues | TournamentFormValues;

export interface RingGameOption {
	ante?: number | null;
	anteType?: string | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	currencyId?: string | null;
	id: string;
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	name: string;
	tableSize?: number | null;
	variant?: string | null;
}

export interface TournamentOption {
	bountyAmount?: number | null;
	buyIn?: number | null;
	currencyId?: string | null;
	entryFee?: number | null;
	/** Rule declares a previous day → offer to link a promoted session. */
	hasPreviousDay?: boolean | null;
	id: string;
	name: string;
	startingStack?: number | null;
	tableSize?: number | null;
	variant?: string | null;
}

/** A promoted prior-day session offered as a next-day link target. */
export interface PromotableSessionOption {
	bagStack: number | null;
	id: string;
	ruleName: string;
}

export interface SessionFormDefaults {
	ante?: number;
	anteType?: string;
	beforeDeadline?: boolean;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	blindLevels?: SessionBlindLevelInput[];
	bountyAmount?: number;
	bountyPrizes?: number;
	breakMinutes?: number;
	buyIn?: number;
	cashOut?: number;
	chipPurchases?: SessionChipPurchaseInput[];
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	evCashOut?: number;
	maxBuyIn?: number;
	memo?: string;
	minBuyIn?: number;
	placement?: number;
	prizeMoney?: number;
	ringGameId?: string;
	roomId?: string;
	ruleName?: string;
	sessionDate?: string;
	startingStack?: number;
	startTime?: string;
	tableSize?: number;
	tagIds?: string[];
	/** `datetime-local` string — when the blind timer started. */
	timerStartedAt?: string;
	totalEntries?: number;
	tournamentBuyIn?: number;
	tournamentId?: string;
	type?: "cash_game" | "tournament";
	variant?: string;
}

export const NONE_VALUE = "__none__";

export function getTodayDateString(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function numStrOrEmpty(value: number | undefined): string {
	return value === undefined ? "" : String(value);
}

export function parseOptInt(value: string): number | undefined {
	if (value === "") {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export const sessionFormSchema = z.object({
	sessionDate: z.string().min(1, "Date is required"),
	startTime: z.string(),
	endTime: z.string(),
	breakMinutes: optionalNumericString({ integer: true, min: 0 }),
	memo: z.string(),
	ruleName: z.string(),
	buyIn: optionalNumericString({ integer: true, min: 0 }),
	cashOut: optionalNumericString({ integer: true, min: 0 }),
	evCashOut: optionalNumericString({ integer: true, min: 0 }),
	variant: z.string(),
	blind1: optionalNumericString({ integer: true, min: 0 }),
	blind2: optionalNumericString({ integer: true, min: 0 }),
	blind3: optionalNumericString({ integer: true, min: 0 }),
	ante: optionalNumericString({ integer: true, min: 0 }),
	anteType: z.string(),
	tableSize: z.string(),
	minBuyIn: optionalNumericString({ integer: true, min: 0 }),
	maxBuyIn: optionalNumericString({ integer: true, min: 0 }),
	tournamentBuyIn: optionalNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	startingStack: optionalNumericString({ integer: true, min: 0 }),
	bountyAmount: optionalNumericString({ integer: true, min: 0 }),
	beforeDeadline: z.boolean(),
	timerStartedAt: z.string(),
	placement: optionalNumericString({ integer: true, min: 1 }),
	totalEntries: optionalNumericString({ integer: true, min: 1 }),
	prizeMoney: optionalNumericString({ integer: true, min: 0 }),
	bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
	previousSessionId: z.string(),
});

export function buildDefaults(defaults: SessionFormDefaults | undefined) {
	return {
		sessionDate: defaults?.sessionDate ?? getTodayDateString(),
		startTime: defaults?.startTime ?? "",
		endTime: defaults?.endTime ?? "",
		breakMinutes: numStrOrEmpty(defaults?.breakMinutes),
		memo: defaults?.memo ?? "",
		ruleName: defaults?.ruleName ?? "",
		buyIn: numStrOrEmpty(defaults?.buyIn),
		cashOut: numStrOrEmpty(defaults?.cashOut),
		evCashOut: numStrOrEmpty(defaults?.evCashOut),
		variant: defaults?.variant ?? "nlh",
		blind1: numStrOrEmpty(defaults?.blind1),
		blind2: numStrOrEmpty(defaults?.blind2),
		blind3: numStrOrEmpty(defaults?.blind3),
		ante: numStrOrEmpty(defaults?.ante),
		anteType: defaults?.anteType ?? "none",
		tableSize: defaults?.tableSize?.toString() ?? "",
		minBuyIn: numStrOrEmpty(defaults?.minBuyIn),
		maxBuyIn: numStrOrEmpty(defaults?.maxBuyIn),
		tournamentBuyIn: numStrOrEmpty(defaults?.tournamentBuyIn),
		entryFee: numStrOrEmpty(defaults?.entryFee),
		startingStack: numStrOrEmpty(defaults?.startingStack),
		bountyAmount: numStrOrEmpty(defaults?.bountyAmount),
		beforeDeadline: defaults?.beforeDeadline === true,
		timerStartedAt: defaults?.timerStartedAt ?? "",
		placement: numStrOrEmpty(defaults?.placement),
		totalEntries: numStrOrEmpty(defaults?.totalEntries),
		prizeMoney: numStrOrEmpty(defaults?.prizeMoney),
		bountyPrizes: numStrOrEmpty(defaults?.bountyPrizes),
		previousSessionId: "",
	};
}

export type SessionFormFieldValues = ReturnType<typeof buildDefaults>;

/**
 * Cash-rule field labels whose current form value diverges from the
 * picked master ring game. Empty when no master is selected or every
 * rule field still matches the master.
 */
export function cashOverriddenFields(
	values: Pick<
		SessionFormFieldValues,
		| "ruleName"
		| "variant"
		| "blind1"
		| "blind2"
		| "blind3"
		| "ante"
		| "anteType"
		| "minBuyIn"
		| "maxBuyIn"
		| "tableSize"
	>,
	master: RingGameOption | undefined
): string[] {
	if (!master) {
		return [];
	}
	const checks: [string, string, string][] = [
		["Rule name", values.ruleName, master.name],
		["Variant", values.variant, master.variant ?? "nlh"],
		["SB", values.blind1, numStrOrEmpty(master.blind1 ?? undefined)],
		["BB", values.blind2, numStrOrEmpty(master.blind2 ?? undefined)],
		["Straddle", values.blind3, numStrOrEmpty(master.blind3 ?? undefined)],
		["Ante", values.ante, numStrOrEmpty(master.ante ?? undefined)],
		["Ante type", values.anteType, master.anteType ?? "none"],
		[
			"Min buy-in",
			values.minBuyIn,
			numStrOrEmpty(master.minBuyIn ?? undefined),
		],
		[
			"Max buy-in",
			values.maxBuyIn,
			numStrOrEmpty(master.maxBuyIn ?? undefined),
		],
		["Table size", values.tableSize, master.tableSize?.toString() ?? ""],
	];
	return checks.filter(([, a, b]) => a !== b).map(([label]) => label);
}

/**
 * Tournament-rule field labels whose current form value diverges from
 * the picked master tournament.
 */
export function tournamentOverriddenFields(
	values: Pick<
		SessionFormFieldValues,
		| "ruleName"
		| "variant"
		| "tournamentBuyIn"
		| "entryFee"
		| "startingStack"
		| "bountyAmount"
		| "tableSize"
	>,
	master: TournamentOption | undefined
): string[] {
	if (!master) {
		return [];
	}
	const checks: [string, string, string][] = [
		["Rule name", values.ruleName, master.name],
		["Variant", values.variant, master.variant ?? "nlh"],
		[
			"Buy-in",
			values.tournamentBuyIn,
			numStrOrEmpty(master.buyIn ?? undefined),
		],
		["Entry fee", values.entryFee, numStrOrEmpty(master.entryFee ?? undefined)],
		[
			"Starting stack",
			values.startingStack,
			numStrOrEmpty(master.startingStack ?? undefined),
		],
		[
			"Bounty amount",
			values.bountyAmount,
			numStrOrEmpty(master.bountyAmount ?? undefined),
		],
		["Table size", values.tableSize, master.tableSize?.toString() ?? ""],
	];
	return checks.filter(([, a, b]) => a !== b).map(([label]) => label);
}
