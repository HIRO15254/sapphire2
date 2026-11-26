import { LEDGER_MAX_QUANTITY } from "@sapphire2/db/constants/ledger";

const DECIMAL_TEXT = /^(?<whole>\d+)(?:\.(?<fraction>\d+))?$/u;
const LEADING_ZEROS = /^0+(?=\d)/u;
const ALL_ZEROS = /^0+$/u;
const TRAILING_ZEROS = /0+$/u;

export type ParseResult<T> =
	| { ok: true; value: T }
	| { error: string; ok: false };

interface ParsedDecimal {
	digits: string;
	scale: number;
}

export function parseDecimalText(
	input: string,
	maxScale: number
): ParseResult<ParsedDecimal> {
	const raw = input.replaceAll(",", "").trim();
	if (raw === "") {
		return { error: "Enter an amount", ok: false };
	}
	const match = DECIMAL_TEXT.exec(raw);
	if (!match?.groups) {
		return { error: "Use digits only", ok: false };
	}
	const whole = match.groups.whole ?? "0";
	const fraction = match.groups.fraction ?? "";
	if (fraction.length > maxScale) {
		return {
			error:
				maxScale === 0
					? "Whole numbers only"
					: `Up to ${maxScale} decimal places`,
			ok: false,
		};
	}
	const digits = `${whole}${fraction}`.replace(LEADING_ZEROS, "");
	if (ALL_ZEROS.test(digits)) {
		return { error: "Enter an amount above 0", ok: false };
	}
	return { ok: true, value: { digits, scale: fraction.length } };
}

export function parseQuantity(
	input: string,
	decimals: number
): ParseResult<number> {
	const parsed = parseDecimalText(input, decimals);
	if (!parsed.ok) {
		return parsed;
	}
	const quantity =
		BigInt(parsed.value.digits) * 10n ** BigInt(decimals - parsed.value.scale);
	if (quantity > BigInt(LEDGER_MAX_QUANTITY)) {
		return { error: "This amount is too large", ok: false };
	}
	return { ok: true, value: Number(quantity) };
}

export function quantityToInput(quantity: number, decimals: number): string {
	const magnitude = Math.abs(quantity);
	if (decimals === 0) {
		return String(magnitude);
	}
	const text = String(magnitude).padStart(decimals + 1, "0");
	const whole = text.slice(0, -decimals);
	const fraction = text.slice(-decimals).replace(TRAILING_ZEROS, "");
	return fraction ? `${whole}.${fraction}` : whole;
}

const formatters = new Map<number, Intl.NumberFormat>();

function formatterFor(decimals: number) {
	let formatter = formatters.get(decimals);
	if (!formatter) {
		formatter = new Intl.NumberFormat("en-US", {
			maximumFractionDigits: decimals,
			minimumFractionDigits: decimals,
		});
		formatters.set(decimals, formatter);
	}
	return formatter;
}

export function formatQuantity(quantity: number, decimals: number): string {
	return formatterFor(decimals).format(Math.abs(quantity) / 10 ** decimals);
}

interface AmountAsset {
	decimals: number;
	kind: "currency" | "item";
	unit: string | null;
}

function withUnit(text: string, unit: string | null) {
	return unit ? `${text} ${unit}` : text;
}

export function formatSignedQuantity(quantity: number, asset: AmountAsset) {
	let sign = "";
	if (quantity > 0) {
		sign = "+";
	} else if (quantity < 0) {
		sign = "−";
	}
	return withUnit(
		`${sign}${formatQuantity(quantity, asset.decimals)}`,
		asset.unit
	);
}

export function formatBalanceNumber(quantity: number, asset: AmountAsset) {
	if (asset.kind === "item" && !asset.unit) {
		return `×${formatQuantity(quantity, asset.decimals)}`;
	}
	return `${quantity < 0 ? "−" : ""}${formatQuantity(quantity, asset.decimals)}`;
}

export function formatBalance(quantity: number, asset: AmountAsset) {
	const number = formatBalanceNumber(quantity, asset);
	return asset.kind === "item" && !asset.unit
		? number
		: withUnit(number, asset.unit);
}
