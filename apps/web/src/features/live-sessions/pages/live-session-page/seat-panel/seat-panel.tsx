import type { ReactNode } from "react";

export function SeatPanel({ children }: { children: ReactNode }) {
	return (
		<div className="mx-[var(--m-inset)] my-2.5 flex min-h-16 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
			{children}
		</div>
	);
}
