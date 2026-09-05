import { useEffect, useRef, useState } from "react";

export const DESCRIPTION_COLLAPSED_MAX_PX = 160;

export function useCurrencyDescription() {
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

	const maxHeight = isExpanded ? contentHeight : DESCRIPTION_COLLAPSED_MAX_PX;

	return {
		contentRef,
		isExpanded,
		isOverflowing,
		maxHeight,
		toggle: () => setIsExpanded((value) => !value),
	};
}
