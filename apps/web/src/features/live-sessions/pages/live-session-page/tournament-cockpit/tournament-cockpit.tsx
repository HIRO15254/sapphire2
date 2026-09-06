import { ActionBar } from "../action-bar";
import { BlindLevelBar } from "../blind-level-bar";
import { PausedOverlay } from "../paused-overlay";
import { SeatPanelPlaceholder } from "../seat-panel-placeholder";
import { SessionHeader } from "../session-header";
import { EndTournamentSheet, EventEditorSheet, TimelineSheet } from "../sheets";
import { StalenessLine } from "../staleness-line";
import { TableView } from "../table-view";
import { TournamentQuickInput } from "../tournament-quick-input";
import { TournamentTableStats } from "./tournament-table-stats";
import { useTournamentCockpit } from "./use-tournament-cockpit";

export function TournamentCockpit({ sessionId }: { sessionId: string }) {
	const cockpit = useTournamentCockpit(sessionId);

	if (cockpit.isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center p-4 text-muted-foreground text-sm">
				Loading session...
			</div>
		);
	}

	const { journal } = cockpit;

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
				{cockpit.isKeyboardOpen || cockpit.blindLevel === null ? null : (
					<BlindLevelBar
						isStartPending={cockpit.isUpdatingTimer}
						level={cockpit.blindLevel}
						onStartTimer={cockpit.onStartTimer}
					/>
				)}
				{cockpit.isKeyboardOpen ? null : (
					<TableView
						center={
							<TournamentTableStats
								avgText={cockpit.avgText}
								bbText={cockpit.bbText}
								remainText={cockpit.remainText}
								stackFormatted={cockpit.stackFormatted}
							/>
						}
						seats={cockpit.seats}
					/>
				)}
				<SeatPanelPlaceholder />
				<div className="shrink-0 border-border border-t bg-card">
					<div className="flex flex-col gap-1.5 px-[var(--m-inset)] pt-2">
						<TournamentQuickInput
							currentStack={cockpit.currentStack}
							isDisabled={!cockpit.canRecordStack}
							isPending={cockpit.isStackPending}
							onSubmit={cockpit.onRecordStack}
							remainingPlayers={cockpit.remainingPlayers}
							totalEntries={cockpit.totalEntries}
						/>
						<StalenessLine
							referenceLabel={cockpit.referenceLabel}
							source={cockpit.stalenessSource}
							staleness={cockpit.staleness}
						/>
					</div>
					<ActionBar
						canLog={journal.canLog}
						onOpenNewEvent={journal.onOpenNewEvent}
						onOpenTimeline={journal.onOpenTimeline}
						variant="tournament"
					/>
				</div>
				{cockpit.isPaused ? (
					<PausedOverlay
						onNote={() => journal.onOpenNewEvent("memo")}
						onResume={cockpit.onResume}
						pausedElapsed={cockpit.pausedElapsed}
					/>
				) : null}
			</div>
			<EndTournamentSheet
				isPending={cockpit.isCompletePending}
				onOpenChange={cockpit.onEndSessionOpenChange}
				onSubmit={cockpit.onCompleteSubmit}
				open={cockpit.isEndSessionOpen}
			/>
			<TimelineSheet
				onOpenChange={journal.onCloseTimeline}
				onSelect={journal.onSelectEvent}
				open={journal.isTimelineOpen}
				rows={journal.rows}
			/>
			{journal.editorTarget === null ? null : (
				<EventEditorSheet
					chipPurchaseOptions={journal.chipPurchaseOptions}
					isPending={journal.isEditorPending}
					isTournament
					maxTime={journal.maxTime}
					minTime={journal.minTime}
					onDelete={journal.onDelete}
					onOpenChange={journal.onCloseEditor}
					onSubmit={journal.onEditorSubmit}
					open={journal.isEditorOpen}
					target={journal.editorTarget}
				/>
			)}
		</div>
	);
}
