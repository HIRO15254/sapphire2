interface ComputeVisibleTagCountArgs {
	/** Inner width available to the tag row, in px. */
	availableWidth: number;
	/** Gap between adjacent badges, in px. */
	gap: number;
	/** Width of the trailing "+N" badge, in px. */
	plusWidth: number;
	/** Natural width of each tag badge, in order. */
	tagWidths: number[];
}

/**
 * Greatest number of leading tag badges that fit on a single line of
 * `availableWidth`. If they do not all fit, room is reserved for the trailing
 * "+N" badge so the overflow indicator is never itself clipped. Pure so the
 * fit math is unit-tested without a layout engine.
 */
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
