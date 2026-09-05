import { useEffect, useState } from "react";

const TEXT_INPUT_TYPES = new Set([
	"email",
	"password",
	"search",
	"tel",
	"text",
	"url",
]);

const OVERLAY_SELECTOR = "[role='dialog'], [data-vaul-drawer]";
const EDITABLE_SELECTOR = "[contenteditable='true'], [contenteditable='']";

function isTextEntryElement(element: Element | null): boolean {
	if (!(element instanceof HTMLElement)) {
		return false;
	}
	if (element.closest(OVERLAY_SELECTOR)) {
		return false;
	}
	if (element instanceof HTMLTextAreaElement) {
		return true;
	}
	if (element.isContentEditable || element.closest(EDITABLE_SELECTOR)) {
		return true;
	}
	if (element instanceof HTMLInputElement) {
		return TEXT_INPUT_TYPES.has(element.type);
	}
	return false;
}

export function useKeyboardOpen(): boolean {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		let pending = 0;
		const sync = () => setIsOpen(isTextEntryElement(document.activeElement));
		const onFocusOut = () => {
			window.clearTimeout(pending);
			pending = window.setTimeout(sync, 0);
		};
		sync();
		document.addEventListener("focusin", sync);
		document.addEventListener("focusout", onFocusOut);
		return () => {
			window.clearTimeout(pending);
			document.removeEventListener("focusin", sync);
			document.removeEventListener("focusout", onFocusOut);
		};
	}, []);

	return isOpen;
}
