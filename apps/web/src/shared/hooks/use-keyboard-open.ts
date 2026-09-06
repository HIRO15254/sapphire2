import { useEffect, useState } from "react";

const KEYBOARD_MIN_SHRINK_PX = 120;

export function useKeyboardOpen(): boolean {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) {
			return;
		}

		let tallest = viewport.height;

		const update = () => {
			if (viewport.height > tallest) {
				tallest = viewport.height;
			}
			setIsOpen(tallest - viewport.height >= KEYBOARD_MIN_SHRINK_PX);
		};

		const reset = () => {
			tallest = viewport.height;
			setIsOpen(false);
		};

		viewport.addEventListener("resize", update);
		window.addEventListener("orientationchange", reset);
		return () => {
			viewport.removeEventListener("resize", update);
			window.removeEventListener("orientationchange", reset);
		};
	}, []);

	return isOpen;
}
