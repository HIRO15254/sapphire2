import type { ReactNode } from "react";

interface FilterChipBarProps {
	/** Optional full-width row rendered below the chips (e.g. a scope warning). */
	banner?: ReactNode;
	/** The {@link FilterChip} row. */
	children: ReactNode;
}

/**
 * The sticky, horizontally scrollable container that holds a row of
 * {@link FilterChip}s. Sticks to the top of the scroll area so filters stay
 * reachable while the list below scrolls. Shared by the stats and sessions
 * filter bars.
 */
export function FilterChipBar({ banner, children }: FilterChipBarProps) {
	return (
		<div className="sticky top-0 z-20 border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="flex gap-2 overflow-x-auto px-4 py-3">{children}</div>
			{banner}
		</div>
	);
}
