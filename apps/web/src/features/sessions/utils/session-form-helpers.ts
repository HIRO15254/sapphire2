import z from "zod";
import { optionalNumericString } from "@/shared/lib/form-fields";

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
	memo?: string;
	ringGameId?: string;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

export interface TournamentFormValues {
	addonCost?: number;
	beforeDeadline?: boolean;
	bountyPrizes?: number;
	breakMinutes?: number;
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn: number;
	tournamentId?: string;
	type: "tournament";
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
	name: string;
	tableSize?: number | null;
	variant?: string | null;
}

export interface TournamentOption {
	buyIn?: number | null;
	entryFee?: number | null;
	id: string;
	name: string;
}

export interface SessionFormDefaults {
	addonCost?: number;
	ante?: number;
	anteType?: string;
	beforeDeadline?: boolean;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	bountyPrizes?: number;
	breakMinutes?: number;
	buyIn?: number;
	cashOut?: number;
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	evCashOut?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	ringGameId?: string;
	sessionDate?: string;
	startTime?: string;
	storeId?: string;
	tableSize?: number;
	tagIds?: string[];
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
	tournamentBuyIn: optionalNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	beforeDeadline: z.boolean(),
	placement: optionalNumericString({ integer: true, min: 1 }),
	totalEntries: optionalNumericString({ integer: true, min: 1 }),
	prizeMoney: optionalNumericString({ integer: true, min: 0 }),
	rebuyCount: optionalNumericString({ integer: true, min: 0 }),
	rebuyCost: optionalNumericString({ integer: true, min: 0 }),
	addonCost: optionalNumericString({ integer: true, min: 0 }),
	bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
});

export function buildDefaults(defaults: SessionFormDefaults | undefined) {
	return {
		sessionDate: defaults?.sessionDate ?? getTodayDateString(),
		startTime: defaults?.startTime ?? "",
		endTime: defaults?.endTime ?? "",
		breakMinutes: numStrOrEmpty(defaults?.breakMinutes),
		memo: defaults?.memo ?? "",
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
		tournamentBuyIn: numStrOrEmpty(defaults?.tournamentBuyIn),
		entryFee: numStrOrEmpty(defaults?.entryFee),
		beforeDeadline: defaults?.beforeDeadline === true,
		placement: numStrOrEmpty(defaults?.placement),
		totalEntries: numStrOrEmpty(defaults?.totalEntries),
		prizeMoney: numStrOrEmpty(defaults?.prizeMoney),
		rebuyCount: numStrOrEmpty(defaults?.rebuyCount),
		rebuyCost: numStrOrEmpty(defaults?.rebuyCost),
		addonCost: numStrOrEmpty(defaults?.addonCost),
		bountyPrizes: numStrOrEmpty(defaults?.bountyPrizes),
	};
}

export type SessionFormFieldValues = ReturnType<typeof buildDefaults>;
