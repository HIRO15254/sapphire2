interface ComputeVisibleTagCountArgs {
	availableWidth: number;
	gap: number;
	plusWidth: number;
	tagWidths: number[];
}

export function computeVisibleTagCount({
	availableWidth,
	gap,
	plusWidth,
	tagWidths,
}: ComputeVisibleTagCountArgs): number {
	const count = tagWidths.length;
	if (count === 0) {
		return 0;
	}

	let full = 0;
	for (const [index, width] of tagWidths.entries()) {
		full += width + (index > 0 ? gap : 0);
	}
	if (full <= availableWidth) {
		return count;
	}

	let used = 0;
	let visible = 0;
	for (const [index, width] of tagWidths.entries()) {
		const candidate = used + width + (index > 0 ? gap : 0);
		if (candidate + gap + plusWidth > availableWidth) {
			break;
		}
		used = candidate;
		visible = index + 1;
	}
	return visible;
}
