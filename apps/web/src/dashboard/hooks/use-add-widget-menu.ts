import { useState } from "react";
import type { WidgetType } from "@/dashboard/hooks/use-dashboard-widgets";
import { listWidgetTypes } from "@/dashboard/widgets/registry";

export function useAddWidgetMenu(onSelect: (type: WidgetType) => void) {
	const [open, setOpen] = useState(false);
	const entries = listWidgetTypes();

	const handleSelect = (type: WidgetType) => {
		setOpen(false);
		onSelect(type);
	};

	const handleOpen = () => setOpen(true);

	return {
		entries,
		handleOpen,
		handleSelect,
		open,
		setOpen,
	};
}
