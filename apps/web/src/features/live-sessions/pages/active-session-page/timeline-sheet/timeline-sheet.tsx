import { IconHistory } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { EventEditor } from "@/features/live-sessions/components/event-editors/event-editor";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { TimelineItem } from "./timeline-item";
import { useTimelineSheet } from "./use-timeline-sheet";

export interface TimelineSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export function TimelineSheet({
	onOpenChange,
	open,
	sessionId,
	sessionType,
}: TimelineSheetProps) {
	const {
		items,
		isLoading,
		editEvent,
		editEventTitle,
		onEditOpenChange,
		onEditSubmit,
		onEditTimeUpdate,
		isUpdatePending,
		timeBounds,
	} = useTimelineSheet({ open, sessionId, sessionType });

	let sheetBody: ReactNode;
	if (isLoading) {
		sheetBody = (
			<p className="py-6 text-center text-muted-foreground text-sm">
				Loading...
			</p>
		);
	} else if (items.length === 0) {
		sheetBody = (
			<div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
				<IconHistory size={28} />
				<p className="text-sm">No events yet</p>
			</div>
		);
	} else {
		sheetBody = (
			<div className="flex flex-col gap-0.5">
				{items.map((item) => (
					<TimelineItem item={item} key={item.id} />
				))}
			</div>
		);
	}

	return (
		<>
			<BottomSheet
				cancelLabel="Close"
				onOpenChange={onOpenChange}
				open={open}
				title="Event timeline"
			>
				{sheetBody}
			</BottomSheet>
			<BottomSheet
				cancelLabel="Cancel"
				onOpenChange={onEditOpenChange}
				open={editEvent !== null}
				title={editEventTitle}
			>
				{editEvent ? (
					<EventEditor
						event={editEvent}
						isLoading={isUpdatePending}
						maxTime={timeBounds.maxTime}
						minTime={timeBounds.minTime}
						onSubmit={onEditSubmit}
						onTimeUpdate={onEditTimeUpdate}
						sessionType={sessionType}
					/>
				) : null}
			</BottomSheet>
		</>
	);
}
