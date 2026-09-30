import { IconCards, IconMinus, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CRYST_FOCUS_RING } from "../../cryst-controls";

interface HandCounterProps {
	canEdit: boolean;
	handCount: number;
	onAddHand: () => void;
	onOpenSheet: () => void;
	onRemoveHand: () => void;
}

const SEGMENT_CLASS = `inline-flex items-center justify-center border-border bg-transparent p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${CRYST_FOCUS_RING}`;

export function HandCounter({
	canEdit,
	handCount,
	onAddHand,
	onOpenSheet,
	onRemoveHand,
}: HandCounterProps) {
	return (
		<div className="absolute top-[85.8%] left-1/2 z-[2] inline-flex h-8 -translate-x-1/2 -translate-y-1/2 items-stretch overflow-hidden rounded-md border border-border bg-card shadow-[var(--shadow-sm)]">
			<button
				aria-label="Remove a hand"
				className={cn(
					SEGMENT_CLASS,
					"w-8 border-r text-muted-foreground hover:bg-accent hover:text-foreground"
				)}
				disabled={!canEdit}
				onClick={onRemoveHand}
				type="button"
			>
				<IconMinus size={15} />
			</button>
			<button
				aria-label={`Hand count: ${handCount}`}
				className={cn(
					SEGMENT_CLASS,
					"gap-1.5 px-3 text-[length:var(--text-xs)] text-foreground hover:bg-accent"
				)}
				disabled={!canEdit}
				onClick={onOpenSheet}
				type="button"
			>
				<IconCards className="text-muted-foreground" size={15} />
				<span className="font-mono font-semibold">{handCount}</span>
			</button>
			<button
				aria-label="Add a hand"
				className={cn(
					SEGMENT_CLASS,
					"w-8 border-l text-primary hover:bg-[color-mix(in_oklab,var(--primary)_15%,transparent)]"
				)}
				disabled={!canEdit}
				onClick={onAddHand}
				type="button"
			>
				<IconPlus size={15} />
			</button>
		</div>
	);
}
