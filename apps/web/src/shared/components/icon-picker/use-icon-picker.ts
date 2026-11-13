import { useCallback, useState, useSyncExternalStore } from "react";
import {
	getIconDataVersion,
	iconGlyph,
	subscribeIconData,
} from "@/shared/lib/tabler-icons/icon-data";
import { iconLabel } from "@/shared/lib/tabler-icons/suggested-icons";

interface UseIconPickerOptions {
	onValueChange: (name: string) => void;
	value: string;
}

export function useIconPicker({ onValueChange, value }: UseIconPickerOptions) {
	const [open, setOpen] = useState(false);
	useSyncExternalStore(
		subscribeIconData,
		getIconDataVersion,
		getIconDataVersion
	);
	const current = value && iconGlyph(value) !== null ? value : "";

	const onOpen = useCallback(() => setOpen(true), []);
	const onPick = useCallback(
		(name: string) => {
			onValueChange(name);
			setOpen(false);
		},
		[onValueChange]
	);

	return {
		current,
		currentLabel: current ? iconLabel(current) : "",
		onOpen,
		onOpenChange: setOpen,
		onPick,
		open,
	};
}
