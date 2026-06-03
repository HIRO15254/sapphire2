import { useEffect, useRef, useState } from "react";

/**
 * Collapsed height cap for a currency description. Long rich-text descriptions
 * otherwise sit between the balance hero and the Add-transaction button /
 * transaction list, pushing the primary actions far down the page. We clamp to
 * this height and reveal the rest behind a "Show more" toggle — but only when
 * the content actually overflows, so short descriptions are untouched.
 */
export const DESCRIPTION_COLLAPSED_MAX_PX = 160;

export function useCurrencyDescription() {
	const contentRef = useRef<HTMLDivElement>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isOverflowing, setIsOverflowing] = useState(false);

	useEffect(() => {
		const el = contentRef.current;
		if (!el) {
			return;
		}
		const measure = () => {
			setIsOverflowing(el.scrollHeight > DESCRIPTION_COLLAPSED_MAX_PX);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return {
		collapsedMaxPx: DESCRIPTION_COLLAPSED_MAX_PX,
		contentRef,
		isExpanded,
		isOverflowing,
		toggle: () => setIsExpanded((value) => !value),
	};
}
