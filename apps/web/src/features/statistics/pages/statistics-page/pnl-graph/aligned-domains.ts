// Ported from the retired dashboard pnl-graph-widget. Computes y-axis domains
// for the dual-axis normalized "all" view so the zero line of the BB (cash) and
// BI (tournament) series sit at the same vertical position.
export interface ChartPoint {
	cashCumulative?: number;
	cumulative?: number;
	evCashCumulative?: number;
	tournamentCumulative?: number;
	x: number;
}

export function computeAlignedDomain(
	min: number,
	max: number,
	negFrac: number
): [number, number] {
	if (min === 0 && max === 0) {
		return [-1, 1];
	}
	if (negFrac === 0) {
		return [0, max || 1];
	}
	if (negFrac === 1) {
		return [min || -1, 0];
	}
	const candidateMin = (-max * negFrac) / (1 - negFrac);
	if (candidateMin <= min) {
		return [candidateMin, max];
	}
	const newMax = (-min * (1 - negFrac)) / negFrac;
	return [min, newMax];
}

interface ScanResult {
	bbMax: number;
	bbMin: number;
	biMax: number;
	biMin: number;
}

function scanDualValues(points: ChartPoint[]): ScanResult {
	let bbMin = 0;
	let bbMax = 0;
	let biMin = 0;
	let biMax = 0;
	for (const p of points) {
		if (typeof p.cashCumulative === "number") {
			bbMin = Math.min(bbMin, p.cashCumulative);
			bbMax = Math.max(bbMax, p.cashCumulative);
		}
		if (typeof p.evCashCumulative === "number") {
			bbMin = Math.min(bbMin, p.evCashCumulative);
			bbMax = Math.max(bbMax, p.evCashCumulative);
		}
		if (typeof p.tournamentCumulative === "number") {
			biMin = Math.min(biMin, p.tournamentCumulative);
			biMax = Math.max(biMax, p.tournamentCumulative);
		}
	}
	return { bbMin, bbMax, biMin, biMax };
}

export function alignedDualDomains(points: ChartPoint[]): {
	bb: [number, number];
	bi: [number, number];
} {
	const { bbMin, bbMax, biMin, biMax } = scanDualValues(points);
	const bbRange = bbMax - bbMin || 1;
	const biRange = biMax - biMin || 1;
	const bbNegFrac = -bbMin / bbRange;
	const biNegFrac = -biMin / biRange;
	const negFrac = Math.max(bbNegFrac, biNegFrac);
	return {
		bb: computeAlignedDomain(bbMin, bbMax, negFrac),
		bi: computeAlignedDomain(biMin, biMax, negFrac),
	};
}
