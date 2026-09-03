import { useState } from "react";

export function useSeatList() {
	const [expandedKey, setExpandedKey] = useState<string | null>(null);

	return {
		collapse: () => setExpandedKey(null),
		expandedKey,
		onToggle: (key: string) =>
			setExpandedKey((previous) => (previous === key ? null : key)),
	};
}
