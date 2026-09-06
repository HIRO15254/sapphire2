import { IconUserSearch } from "@tabler/icons-react";

export function SeatPanelPlaceholder() {
	return (
		<div className="mx-[var(--m-inset)] my-2.5 flex min-h-16 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
			<div className="flex h-full min-h-16 flex-col items-center justify-center gap-1.5 p-4 text-muted-foreground">
				<IconUserSearch size={20} />
				<span className="text-pretty text-center text-[length:var(--m-text-footnote)]">
					Tap a seated player to edit their profile here
				</span>
			</div>
		</div>
	);
}
