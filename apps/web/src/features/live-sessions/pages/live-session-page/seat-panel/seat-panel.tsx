import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CRYST_CARD } from "../cryst-controls";

export function SeatPanel({ children }: { children: ReactNode }) {
	return (
		<div
			className={cn(
				CRYST_CARD,
				"mx-[var(--m-inset)] my-2.5 flex min-h-16 flex-1 flex-col overflow-hidden"
			)}
		>
			{children}
		</div>
	);
}
