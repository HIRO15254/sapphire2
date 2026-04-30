import { IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { EventEditor } from "@/features/live-sessions/components/event-editors/event-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	formatEventLabel,
	formatPayloadSummary,
	LIFECYCLE_EVENTS,
} from "@/features/live-sessions/utils/session-events-formatters";
import { toTimeInputValue } from "@/features/live-sessions/utils/stack-editor-time";
import { PageHeader } from "@/shared/components/page-header";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useSessionEventsScene } from "./use-session-events-scene";

type SessionType = "cash_game" | "tournament";

interface SessionEventsSceneProps {
	emptySessionMessage?: string;
	refetchInterval?: number;
	sessionId: string;
	sessionLoading?: boolean;
	sessionType: SessionType;
}

export function SessionEventsScene({
	emptySessionMessage = "No active session",
	refetchInterval,
	sessionId,
	sessionLoading = false,
	sessionType,
}: SessionEventsSceneProps) {
	const {
		editEvent,
		setEditEvent,
		confirmingDeleteId,
		setConfirmingDeleteId,
		events,
		update,
		deleteEvent,
		isUpdatePending,
		groups,
		timeBounds,
	} = useSessionEventsScene({ sessionId, sessionType, refetchInterval });

	if (sessionLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}
	if (!sessionId) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">{emptySessionMessage}</p>
			</div>
		);
	}
	function renderEventRow(event: SessionEvent) {
		const payloadSummary = formatPayloadSummary(event.eventType, event.payload);
		const isLifecycle = LIFECYCLE_EVENTS.has(event.eventType);
		const canDelete = !isLifecycle;
		return (
			<div className="relative flex gap-3 pb-4" key={event.id}>
				<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
					{toTimeInputValue(event.occurredAt)}
				</div>
				<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<div>
							<span className="font-medium text-sm">
								{formatEventLabel(event.eventType)}
							</span>
							{payloadSummary ? (
								<p className="mt-0.5 text-muted-foreground text-xs">
									{payloadSummary}
								</p>
							) : null}
						</div>
						<div className="flex shrink-0 items-center gap-1">
							{canDelete && confirmingDeleteId === event.id ? (
								<>
									<span className="text-destructive text-xs">Delete?</span>
									<Button
										aria-label="Confirm delete"
										className="text-destructive hover:text-destructive"
										onClick={() => {
											deleteEvent(event.id);
											setConfirmingDeleteId(null);
										}}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<IconTrash size={14} />
									</Button>
									<Button
										aria-label="Cancel delete"
										onClick={() => setConfirmingDeleteId(null)}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<IconX size={14} />
									</Button>
								</>
							) : (
								<>
									<Button
										aria-label={`Edit ${formatEventLabel(event.eventType)}`}
										onClick={() => setEditEvent(event)}
										size="icon-xs"
										variant="ghost"
									>
										<IconPencil size={14} />
									</Button>
									{canDelete && (
										<Button
											aria-label={`Delete ${formatEventLabel(event.eventType)}`}
											className="text-destructive hover:text-destructive"
											onClick={() => setConfirmingDeleteId(event.id)}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<IconTrash size={14} />
										</Button>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6">
			<PageHeader heading="Timeline" />
			{events.length === 0 ? (
				<EmptyState
					className="border-none bg-transparent px-0 py-8"
					description="Once play starts, session events will appear here in timeline order."
					heading="No events recorded yet."
				/>
			) : (
				<div className="relative">
					<div className="absolute top-0 bottom-0 left-[52px] w-px bg-border" />
					{groups.map((group) => {
						if (group.type === "single") {
							return renderEventRow(group.event);
						}
						const first = group.events[0];
						const last = group.events.at(-1);
						const timeRange = `${toTimeInputValue(first.occurredAt)}–${toTimeInputValue(last?.occurredAt ?? first.occurredAt)}`;
						const summary = `${group.events.length} player changes`;
						return (
							<Accordion className="relative" key={first.id} type="multiple">
								<AccordionItem className="border-b-0" value={first.id}>
									<div className="relative flex gap-3">
										<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
											{toTimeInputValue(first.occurredAt)}
										</div>
										<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
										<div className="min-w-0 flex-1">
											<AccordionTrigger className="py-0 pb-4">
												<span className="font-medium text-sm">
													{summary} · {timeRange}
												</span>
											</AccordionTrigger>
										</div>
									</div>
									<AccordionContent className="pb-0">
										{group.events.map((event) => renderEventRow(event))}
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						);
					})}
				</div>
			)}
			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditEvent(null);
					}
				}}
				open={editEvent !== null}
				title={`Edit ${editEvent ? formatEventLabel(editEvent.eventType) : ""}`}
			>
				{editEvent ? (
					<EventEditor
						event={editEvent}
						isLoading={isUpdatePending}
						maxTime={timeBounds.maxTime}
						minTime={timeBounds.minTime}
						onSubmit={(payload, occurredAt) =>
							update({
								id: editEvent.id,
								payload,
								occurredAt,
							}).then(() => setEditEvent(null))
						}
						onTimeUpdate={(occurredAt) =>
							update({ id: editEvent.id, occurredAt }).then(() =>
								setEditEvent(null)
							)
						}
						sessionType={sessionType}
					/>
				) : null}
			</ResponsiveDialog>
		</div>
	);
}
