import { ASSET_RATE_MAX_TERM } from "@sapphire2/db/constants/asset";
import { type ParseResult, parseDecimalText } from "./amount";

export const RATE_MAX_DECIMALS = 6;

function gcd(a: bigint, b: bigint): bigint {
	let x = a;
	let y = b;
	while (y !== 0n) {
		[x, y] = [y, x % y];
	}
	return x;
}

export function parseRate(
	input: string,
	baseDecimals: number,
	quoteDecimals: number
): ParseResult<{ rateDen: number; rateNum: number }> {
	const parsed = parseDecimalText(input, RATE_MAX_DECIMALS);
	if (!parsed.ok) {
		return parsed;
	}
	const num = BigInt(parsed.value.digits) * 10n ** BigInt(quoteDecimals);
	const den = 10n ** BigInt(parsed.value.scale + baseDecimals);
	const divisor = gcd(num, den);
	const rateNum = num / divisor;
	const rateDen = den / divisor;
	const max = BigInt(ASSET_RATE_MAX_TERM);
	if (rateNum > max || rateDen > max) {
		return { error: "This rate is out of range", ok: false };
	}
	return {
		ok: true,
		value: { rateDen: Number(rateDen), rateNum: Number(rateNum) },
	};
}

export function rateValue(
	rate: { rateDen: number; rateNum: number },
	baseDecimals: number,
	quoteDecimals: number
): number {
	return (rate.rateNum / rate.rateDen) * 10 ** (baseDecimals - quoteDecimals);
}

const RATE_FORMATTER = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: RATE_MAX_DECIMALS,
});

export function formatRate(value: number): string {
	return RATE_FORMATTER.format(value);
}
