import { dayLabel } from "@/features/assets/utils/dates";
import { formatRate } from "@/features/assets/utils/rate";

const DAY_MS = 86_400_000;
const WIDTH = 310;

export interface RateChart {
	from: string;
	max: string;
	min: string;
	path: string;
}

export function buildRateChart(
	points: readonly { at: number; value: number }[],
	now: Date
): RateChart | null {
	const shown = points.filter((point) => point.at <= now.getTime());
	if (shown.length < 2) {
		return null;
	}
	const dated = shown.filter((point) => point.at > 0);
	const t1 = now.getTime() / DAY_MS;
	const hasStart = shown[0]?.at === 0;
	const firstDated = dated[0] ? dated[0].at / DAY_MS : t1;
	const t0 =
		dated.length > 0
			? firstDated -
				(hasStart ? Math.max(7, Math.round((t1 - firstDated) * 0.25)) : 0)
			: t1;
	if (!(t1 > t0)) {
		return null;
	}
	const values = shown.map((point) => point.value);
	const lo = Math.min(...values);
	const hi = Math.max(...values);
	const yOf = (value: number) =>
		hi === lo
			? 32
			: Math.round((58 - ((value - lo) / (hi - lo)) * 52) * 10) / 10;
	const xOf = (at: number) =>
		at === 0
			? 0
			: Math.round(((at / DAY_MS - t0) / (t1 - t0)) * WIDTH * 10) / 10;
	let path = "";
	shown.forEach((point, index) => {
		path +=
			index === 0
				? `M0 ${yOf(point.value)}`
				: ` H${xOf(point.at)} V${yOf(point.value)}`;
	});
	path += ` H${WIDTH}`;
	let from = "";
	if (hasStart) {
		from = "Start";
	} else if (dated[0]) {
		from = dayLabel(new Date(dated[0].at), now);
	}
	return { from, max: formatRate(hi), min: formatRate(lo), path };
}
