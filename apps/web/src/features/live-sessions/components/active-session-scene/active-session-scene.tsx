import { IconDotsVertical } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	ActionsDrawer,
	type ActionsDrawerItem,
} from "@/features/live-sessions/components/actions-drawer";
import { SeatFromScreenshotSheet } from "@/features/live-sessions/components/seat-from-screenshot-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { GameSettingsSheet } from "./game-settings-sheet";
import { HistorySection } from "./history-section";
import { SeatList } from "./seat-list";
import { useActiveSessionScene } from "./use-active-session-scene";
import type { ActiveSessionSceneState } from "./use-active-session-scene-state";

interface ActiveSessionSceneProps {
	discardDescription?: ReactNode;
	/** Session-type-specific event actions shown in the header "…" menu. */
	eventMenuExtraItems: ActionsDrawerItem[];
	isDiscardPending: boolean;
	memo?: string | null;
	onDiscard: () => void;
	onEndSession: () => void;
	onPause: () => void;
	state: ActiveSessionSceneState;
	summary: ReactNode;
	title: string;
	topSlot?: ReactNode;
}

function DiscardDialog({
	description,
	isOpen,
	isPending,
	onClose,
	onConfirm,
}: {
	description: ReactNode;
	isOpen: boolean;
	isPending: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Discard Session</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onClose} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "Discarding..." : "Discard"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Single-page active-session scene (SA2-59): a display-only status summary on
 * top, the lightweight seated-player list, and the collapsed event history.
 * All event recording is consolidated into the "+" menu opened from the
 * bottom-nav center button; session lifecycle actions live in the header
 * overflow menu.
 */
export function ActiveSessionScene({
	discardDescription = "This will permanently delete this session and all its events.",
	eventMenuExtraItems,
	isDiscardPending,
	memo,
	onDiscard,
	onEndSession,
	onPause,
	state,
	summary,
	title,
	topSlot,
}: ActiveSessionSceneProps) {
	const scene = useActiveSessionScene({
		eventMenuExtraItems,
		onEndSession,
		onPause,
		state,
	});

	return (
		<>
			<PageHeader
				actions={
					<Button
						aria-label="Session actions"
						onClick={scene.onOpenSessionMenu}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<IconDotsVertical size={20} />
					</Button>
				}
				heading={title}
			/>

			{topSlot ? <div className="mb-2">{topSlot}</div> : null}

			<div>{summary}</div>

			{memo ? (
				<p className="mt-1 text-muted-foreground text-xs">{memo}</p>
			) : null}

			<div className="mt-4">
				<SeatList
					excludePlayerIds={state.excludePlayerIds}
					onRemovePlayer={state.onRemovePlayer}
					onScanPlayers={() => scene.setIsScanSheetOpen(true)}
					onSeatExisting={state.onSeatExisting}
					onSeatNew={state.onSeatNew}
					onSeatTemporary={state.onSeatTemporary}
					seats={state.seats}
					unseatedPlayers={state.unseatedPlayers}
				/>
			</div>

			<div className="mt-4">
				<HistorySection
					sessionId={scene.sessionId}
					sessionType={scene.sessionType}
				/>
			</div>

			<ActionsDrawer
				description="Record an event, pause, end, configure or discard this session."
				items={scene.sessionMenuItems}
				onOpenChange={scene.setIsSessionMenuOpen}
				open={scene.isSessionMenuOpen}
				title="Session actions"
			/>

			<SeatFromScreenshotSheet
				heroSeatPosition={state.heroSeatPosition}
				occupiedSeatPositions={state.occupiedSeatPositions}
				onOpenChange={scene.setIsScanSheetOpen}
				open={scene.isScanSheetOpen}
				sessionParam={state.sessionParam}
			/>

			<GameSettingsSheet
				onOpenChange={scene.setIsGameSettingsOpen}
				open={scene.isGameSettingsOpen}
			/>

			<DiscardDialog
				description={discardDescription}
				isOpen={scene.isDiscardOpen}
				isPending={isDiscardPending}
				onClose={() => scene.setIsDiscardOpen(false)}
				onConfirm={onDiscard}
			/>
		</>
	);
}
