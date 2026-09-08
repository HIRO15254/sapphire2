import { formatNumber } from "@/utils/format-number";

const SYMBOL_UNIT_LENGTH = 1;
const SAMPLE_AMOUNT = 51_800;

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

export function currencySample(unit: string | null | undefined): string {
	return formatWithUnit(SAMPLE_AMOUNT, unit);
}

export function currencyRowLabel(currency: CurrencyLike | null): string {
	if (currency === null) {
		return "Not set";
	}
	return currency.unit ? `${currency.unit} ${currency.name}` : currency.name;
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

export function filterTagCandidates(
	tags: readonly SessionTagLike[],
	selectedIds: readonly string[],
	query: string
): SessionTagLike[] {
	const needle = query.trim().toLowerCase();
	return tags.filter(
		(tag) =>
			!selectedIds.includes(tag.id) &&
			(needle === "" || tag.name.toLowerCase().includes(needle))
	);
}

export function findExactTag(
	tags: readonly SessionTagLike[],
	name: string
): SessionTagLike | null {
	const needle = name.trim().toLowerCase();
	if (needle === "") {
		return null;
	}
	return tags.find((tag) => tag.name.toLowerCase() === needle) ?? null;
}
