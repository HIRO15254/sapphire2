import { useState } from "react";
import type { SessionFilterValues } from "@/sessions/components/session-filters";
import { countActiveFilters } from "@/sessions/utils/session-filters-helpers";

interface UseSessionFiltersProps {
	filters: SessionFilterValues;
	onFiltersChange: (filters: SessionFilterValues) => void;
}

export function useSessionFilters({
	filters,
	onFiltersChange,
}: UseSessionFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState<SessionFilterValues>(filters);
	const activeCount = countActiveFilters(filters);

	const handleOpen = () => {
		setDraft(filters);
		setIsOpen(true);
	};

	const handleApply = () => {
		onFiltersChange(draft);
		setIsOpen(false);
	};

	const handleReset = () => {
		const empty: SessionFilterValues = {};
		setDraft(empty);
		onFiltersChange(empty);
		setIsOpen(false);
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setIsOpen(false);
		}
	};

	const updateDraft = (patch: Partial<SessionFilterValues>) => {
		setDraft((prev) => ({ ...prev, ...patch }));
	};

	return {
		activeCount,
		draft,
		isOpen,
		onApply: handleApply,
		onOpen: handleOpen,
		onOpenChange: handleOpenChange,
		onReset: handleReset,
		updateDraft,
	};
}
