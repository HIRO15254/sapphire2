import { useLayoutEffect, useRef, useState } from "react";
import { computeVisibleTagCount } from "@/features/live-sessions/utils/tag-overflow";

const TAG_GAP_PX = 4;

/**
 * Measures the row against an invisible "ghost" layer (all tags + a sample +N
 * badge) and returns how many leading tags fit on one line. Re-measures on
 * container resize and whenever the tag set changes by identity (count, rename,
 * or swap) so the fold position never goes stale.
 */
export function usePlayerTagBadges(tags: { id: string; name: string }[]) {
	const containerRef = useRef<HTMLDivElement>(null);
	const ghostRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState(tags.length);

	// Identity signature: a same-count content change (rename / swap) shifts
	// badge widths even though the container width is unchanged.
	const signature = tags.map((tag) => `${tag.id}:${tag.name}`).join("|");

	// biome-ignore lint/correctness/useExhaustiveDependencies: signature re-runs the measure when the tag set (and thus the ghost layer) changes; the effect reads widths from the rendered ghost, not the signature directly.
	useLayoutEffect(() => {
		const container = containerRef.current;
		const ghost = ghostRef.current;
		if (!(container && ghost)) {
			return;
		}

		const measure = () => {
			const children = Array.from(ghost.children) as HTMLElement[];
			if (children.length === 0) {
				setVisibleCount(0);
				return;
			}
			const plus = children.at(-1);
			const tagWidths = children
				.slice(0, -1)
				.map((el) => el.getBoundingClientRect().width);
			setVisibleCount(
				computeVisibleTagCount({
					availableWidth: container.getBoundingClientRect().width,
					gap: TAG_GAP_PX,
					plusWidth: plus?.getBoundingClientRect().width ?? 0,
					tagWidths,
				})
			);
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		return () => observer.disconnect();
	}, [signature]);

	return { containerRef, ghostRef, visibleCount };
}
