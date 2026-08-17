import type { ReactNode } from "react";

interface FilterChipBarProps {
	banner?: ReactNode;
	children: ReactNode;
}

export function FilterChipBar({ banner, children }: FilterChipBarProps) {
	return (
		<div className="sticky top-0 z-20 border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="flex gap-2 overflow-x-auto px-4 py-3">{children}</div>
			{banner}
		</div>
	);
}
