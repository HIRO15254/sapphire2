import { IconUserSearch } from "@tabler/icons-react";
import { ActionBar } from "../action-bar";
import { PausedOverlay } from "../paused-overlay";
import { SessionHeader } from "../session-header";
import { EndSessionSheet } from "../sheets";
import { StackQuickInput } from "../stack-quick-input";
import { StalenessLine } from "../staleness-line";
import { TableView } from "../table-view";
import { useCashCockpit } from "./use-cash-cockpit";

export function CashCockpit({ sessionId }: { sessionId: string }) {
	const cockpit = useCashCockpit(sessionId);

	if (cockpit.isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center p-4 text-muted-foreground text-sm">
				Loading session...
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SessionHeader
				elapsed={cockpit.elapsed}
				isMasterLinked={cockpit.isMasterLinked}
				isPaused={cockpit.isPaused}
				onEndSession={cockpit.onEndSession}
				onPause={cockpit.onPause}
				onResume={cockpit.onResume}
				ruleName={cockpit.ruleName}
			/>
			<div className="relative flex min-h-0 flex-1 flex-col">
				{cockpit.isKeyboardOpen ? null : (
					<TableView
						bbText={cockpit.bbText}
						displayPL={cockpit.displayPL}
						displayPLFormatted={cockpit.displayPLFormatted}
						evPLFormatted={cockpit.evPLFormatted}
						seats={cockpit.seats}
						stackFormatted={cockpit.stackFormatted}
					/>
				)}
				<div className="mx-[var(--m-inset)] my-2.5 flex min-h-16 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
					<div className="flex h-full min-h-16 flex-col items-center justify-center gap-1.5 p-4 text-muted-foreground">
						<IconUserSearch size={20} />
						<span className="text-pretty text-center text-[length:var(--m-text-footnote)]">
							Tap a seated player to edit their profile here
						</span>
					</div>
				</div>
				<div className="shrink-0 border-border border-t bg-card">
					<div className="flex flex-col gap-1.5 px-[var(--m-inset)] pt-2">
						<StackQuickInput
							currentStack={cockpit.defaultFinalStack ?? null}
							isDisabled={!cockpit.canRecordStack}
							isPending={cockpit.isStackPending}
							onSubmit={cockpit.onRecordStack}
						/>
						<StalenessLine
							lastUpdateLabel={cockpit.lastUpdateLabel}
							staleness={cockpit.staleness}
						/>
					</div>
					<ActionBar />
				</div>
				{cockpit.isPaused ? (
					<PausedOverlay
						onResume={cockpit.onResume}
						pausedElapsed={cockpit.pausedElapsed}
					/>
				) : null}
			</div>
			<EndSessionSheet
				chipRemoveTotal={cockpit.chipRemoveTotal}
				defaultFinalStack={cockpit.defaultFinalStack}
				evDiff={cockpit.evDiff}
				isPending={cockpit.isCompletePending}
				onOpenChange={cockpit.onEndSessionOpenChange}
				onSubmit={cockpit.onCompleteSubmit}
				open={cockpit.isEndSessionOpen}
				totalBuyIn={cockpit.totalBuyIn}
			/>
		</div>
	);
}
