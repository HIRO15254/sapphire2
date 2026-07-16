import { useEffect, useRef, useState } from "react";

/**
 * Collapsed height cap for an item description. Long rich-text descriptions
 * otherwise sit between the holdings hero and the Add-transaction button /
 * transaction list, pushing the primary actions far down the page. We clamp to
 * this height and reveal the rest behind a "Show more" toggle — but only when
 * the content actually overflows, so short descriptions are untouched.
 */
export const DESCRIPTION_COLLAPSED_MAX_PX = 160;

export function useItemDescription() {
	const contentRef = useRef<HTMLDivElement>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [contentHeight, setContentHeight] = useState(0);

	useEffect(() => {
		const el = contentRef.current;
		if (!el) {
			return;
		}
		const measure = () => {
			setContentHeight(el.scrollHeight);
			setIsOverflowing(el.scrollHeight > DESCRIPTION_COLLAPSED_MAX_PX);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Expanding to the measured pixel height (instead of removing the cap) keeps
	// `max-height` animatable in both directions; the collapsed state caps at the
	// fixed clamp height.
	const maxHeight = isExpanded ? contentHeight : DESCRIPTION_COLLAPSED_MAX_PX;

	return {
		contentRef,
		isExpanded,
		isOverflowing,
		maxHeight,
		toggle: () => setIsExpanded((value) => !value),
	};
}
