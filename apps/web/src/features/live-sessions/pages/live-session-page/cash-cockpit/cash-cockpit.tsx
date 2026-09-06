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
				<TableView
					bigBlinds={cockpit.bigBlinds}
					displayPL={cockpit.displayPL}
					displayPLFormatted={cockpit.displayPLFormatted}
					evPLFormatted={cockpit.evPLFormatted}
					seats={cockpit.seats}
					stackFormatted={cockpit.stackFormatted}
				/>
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-[var(--m-inset)] text-center text-[11px] text-muted-foreground">
					<IconUserSearch size={20} />
					Seat and player details are not editable on this screen yet
				</div>
				<div className="shrink-0 border-border border-t bg-card px-[var(--m-inset)] pt-2">
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
				{cockpit.isPaused ? (
					<PausedOverlay
						elapsed={cockpit.elapsed}
						onResume={cockpit.onResume}
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
