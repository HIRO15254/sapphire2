import { useState } from "react";

/**
 * One-row-at-a-time expansion state for the seat list. Expanding a row collapses
 * any other, so only a single inline editor (seating or memo) is open at once.
 */
export function useSeatList() {
	const [expandedKey, setExpandedKey] = useState<string | null>(null);

	return {
		collapse: () => setExpandedKey(null),
		expandedKey,
		onToggle: (key: string) =>
			setExpandedKey((previous) => (previous === key ? null : key)),
	};
}
