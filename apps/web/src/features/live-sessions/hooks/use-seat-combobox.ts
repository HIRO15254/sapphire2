import { useEffect, useRef, useState } from "react";

export function useSeatCombobox() {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!(popoverOpen && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [popoverOpen]);

	return {
		popoverOpen,
		setPopoverOpen,
		contentWidth,
		anchorRef,
	};
}
