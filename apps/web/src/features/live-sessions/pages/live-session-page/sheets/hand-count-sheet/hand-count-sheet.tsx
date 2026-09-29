import {
	IconCards,
	IconMinus,
	IconPlus,
	IconRotate2,
	IconRotateClockwise2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CRYST_FOCUS_RING } from "../../cryst-controls";
import type { HandCounterView } from "../../use-hand-counter";
import { CrystSheet } from "../cryst-sheet";

interface HandCountSheetProps {
	elapsed: string;
	hands: HandCounterView;
}

const STEPPER_CLASS =
	"inline-flex h-[var(--m-control)] items-stretch overflow-hidden rounded-md border border-border bg-card";

const STEP_CLASS = `inline-flex w-[var(--m-control)] items-center justify-center border-border bg-transparent p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${CRYST_FOCUS_RING}`;

const NEUTRAL_STEP_CLASS = cn(
	STEP_CLASS,
	"text-muted-foreground hover:bg-accent hover:text-foreground"
);

export function HandCountSheet({ elapsed, hands }: HandCountSheetProps) {
	return (
		<CrystSheet
			onOpenChange={hands.onSheetOpenChange}
			open={hands.isSheetOpen}
			title="Hand count"
		>
			<div className="flex flex-col gap-3">
				<div className="flex flex-col items-center gap-1.5 py-1">
					<div className={STEPPER_CLASS}>
						<button
							aria-label="Remove a hand"
							className={cn(NEUTRAL_STEP_CLASS, "border-r")}
							disabled={!hands.canEdit}
							onClick={hands.onRemoveHand}
							type="button"
						>
							<IconMinus size={17} />
						</button>
						<output
							aria-label="Hands this session"
							className="inline-flex min-w-[104px] items-center justify-center gap-[7px] px-3.5 text-foreground"
						>
							<IconCards className="text-muted-foreground" size={16} />
							<span className="font-mono font-semibold text-[20px] tracking-[-0.02em]">
								{hands.handCount}
							</span>
						</output>
						<button
							aria-label="Add a hand"
							className={cn(
								STEP_CLASS,
								"border-l text-primary hover:bg-[color-mix(in_oklab,var(--primary)_15%,transparent)]"
							)}
							disabled={!hands.canEdit}
							onClick={hands.onAddHand}
							type="button"
						>
							<IconPlus size={17} />
						</button>
					</div>
					<span
						aria-hidden
						className="text-[length:var(--m-text-caption)] text-muted-foreground"
					>
						Hands this session
					</span>
				</div>
				<dl className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5 text-[length:var(--text-xs)]">
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Elapsed</dt>
						<dd className="font-mono">{elapsed}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Hands logged</dt>
						<dd className="font-mono">{hands.handCount}</dd>
					</div>
					<div className="flex justify-between border-border border-t pt-1">
						<dt className="font-semibold">Hands / hour</dt>
						<dd className="font-mono">{hands.handsPerHour}</dd>
					</div>
				</dl>
				<div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
					<span
						aria-hidden
						className="inline-flex size-5 items-center justify-center rounded-full bg-foreground font-bold font-mono text-[11px] text-background"
					>
						D
					</span>
					<span className="flex-1 text-[length:var(--m-text-footnote)]">
						Dealer button{" "}
						<span className="font-mono">{hands.dealerSeatLabel}</span>
					</span>
					<div className={cn(STEPPER_CLASS, "shrink-0")}>
						<button
							aria-label="Move the button to the previous player"
							className={cn(NEUTRAL_STEP_CLASS, "border-r")}
							disabled={!hands.canEdit || hands.dealerSeatIndex === null}
							onClick={hands.onMoveDealerBack}
							type="button"
						>
							<IconRotate2 size={17} />
						</button>
						<button
							aria-label="Move the button to the next player"
							className={NEUTRAL_STEP_CLASS}
							disabled={!hands.canEdit || hands.dealerSeatIndex === null}
							onClick={hands.onMoveDealerForward}
							type="button"
						>
							<IconRotateClockwise2 size={17} />
						</button>
					</div>
				</div>
				<p className="text-[11px] text-muted-foreground">
					The button moves to the next seated player with each hand. Use the
					arrows (or tap D) to move it without changing the hand count.
				</p>
			</div>
		</CrystSheet>
	);
}
