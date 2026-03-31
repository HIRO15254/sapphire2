import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StackRecordEditor } from "@/components/live-sessions/stack-record-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/active-session/events")({
	component: ActiveSessionEventsPage,
});

const EVENT_TYPE_LABELS: Record<string, string> = {
	chip_add: "Chip Add",
	stack_record: "Stack Record",
	player_join: "Player Join",
	player_leave: "Player Leave",
	session_start: "Session Start",
	session_end: "Session End",
};

const NON_EDITABLE_EVENTS = new Set(["session_start", "session_end"]);

function formatEventLabel(eventType: string): string {
	return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatTime(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toTimeInputValue(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function applyTimeToDate(original: string | Date, timeStr: string): Date {
	const date = new Date(typeof original === "string" ? original : original);
	const [h, m] = timeStr.split(":").map(Number);
	date.setHours(h ?? 0, m ?? 0);
	return date;
}

function formatPayloadSummary(
	eventType: string,
	payload: unknown
): string | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const p = payload as Record<string, unknown>;

	if (eventType === "chip_add" && typeof p.amount === "number") {
		return `Amount: ${p.amount.toLocaleString()}`;
	}
	if (eventType === "stack_record" && typeof p.stackAmount === "number") {
		const parts = [`Stack: ${p.stackAmount.toLocaleString()}`];
		if (Array.isArray(p.allIns) && p.allIns.length > 0) {
			parts.push(`${p.allIns.length} all-in(s)`);
		}
		return parts.join(" · ");
	}
	return null;
}

interface SessionEvent {
	eventType: string;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
}

function AllInsDetail({ allIns }: { allIns: unknown[] }) {
	return (
		<ul className="mt-1 flex flex-col gap-0.5">
			{allIns.map((item, i) => {
				if (!item || typeof item !== "object") {
					return null;
				}
				const ai = item as Record<string, unknown>;
				const parts: string[] = [];
				if (typeof ai.potSize === "number") {
					parts.push(`Pot: ${ai.potSize.toLocaleString()}`);
				}
				if (typeof ai.equity === "number") {
					parts.push(`Equity: ${ai.equity}%`);
				}
				if (typeof ai.wins === "number") {
					parts.push(`Wins: ${ai.wins}`);
				}
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: static list from payload
					<li className="text-muted-foreground text-xs" key={i}>
						All-in {i + 1}: {parts.join(", ")}
					</li>
				);
			})}
		</ul>
	);
}

function EventDetail({
	eventType,
	payload,
}: {
	eventType: string;
	payload: unknown;
}) {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const p = payload as Record<string, unknown>;

	if (eventType === "stack_record") {
		const hasAllIns: boolean = Array.isArray(p.allIns) && p.allIns.length > 0;
		if (!hasAllIns) {
			return null;
		}
		return (
			<div className="mt-1">
				<AllInsDetail allIns={p.allIns as unknown[]} />
			</div>
		);
	}

	return null;
}

function TimeEditor({
	onChange,
	value,
}: {
	onChange: (v: string) => void;
	value: string;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor="edit-time">Time</Label>
			<Input
				id="edit-time"
				onChange={(e) => onChange(e.target.value)}
				type="time"
				value={value}
			/>
		</div>
	);
}

function AmountEditor({
	event,
	isLoading,
	onDelete: handleDelete,
	onSubmit,
}: {
	event: SessionEvent;
	isLoading: boolean;
	onDelete: () => void;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}) {
	const p = (event.payload ?? {}) as Record<string, unknown>;
	const [amount, setAmount] = useState(String(p.amount ?? 0));
	const [time, setTime] = useState(toTimeInputValue(event.occurredAt));

	return (
		<div className="flex flex-col gap-4">
			<TimeEditor onChange={setTime} value={time} />
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-amount">Amount</Label>
				<Input
					id="edit-amount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setAmount(e.target.value)}
					type="number"
					value={amount}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Button
					disabled={isLoading}
					onClick={() => {
						const newDate = applyTimeToDate(event.occurredAt, time);
						onSubmit(
							{ amount: Number(amount) },
							Math.floor(newDate.getTime() / 1000)
						);
					}}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={handleDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>
		</div>
	);
}

function ActiveSessionEventsPage() {
	const queryClient = useQueryClient();
	const { activeSession, isLoading: isSessionLoading } = useActiveSession();

	const sessionId = activeSession?.id ?? "";

	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);

	const eventsQuery = useQuery({
		...trpc.sessionEvent.list.queryOptions({
			liveCashGameSessionId: sessionId,
		}),
		enabled: !!sessionId,
		refetchInterval: 3000,
	});
	const events = (eventsQuery.data ?? []) as SessionEvent[];

	const eventsKey = trpc.sessionEvent.list.queryOptions({
		liveCashGameSessionId: sessionId,
	}).queryKey;
	const sessionKey = trpc.liveCashGameSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const invalidateAll = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: eventsKey }),
			queryClient.invalidateQueries({ queryKey: sessionKey }),
		]);
	};

	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onSuccess: async () => {
			await invalidateAll();
			setEditEvent(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onSuccess: async () => {
			await invalidateAll();
			setEditEvent(null);
		},
	});

	if (isSessionLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!activeSession) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">No active session</p>
			</div>
		);
	}

	const handleUpdate = (payload: unknown, occurredAt?: number) => {
		if (!editEvent) {
			return;
		}
		updateMutation.mutate({
			id: editEvent.id,
			payload,
			occurredAt,
		});
	};

	return (
		<div className="p-4 md:p-6">
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<h1 className="font-bold text-2xl">Events</h1>
				<Badge variant="outline">{events.length}</Badge>
			</div>

			{events.length === 0 ? (
				<p className="text-muted-foreground text-sm">No events recorded yet.</p>
			) : (
				<div className="relative">
					{/* Vertical line */}
					<div className="absolute top-0 bottom-0 left-[52px] w-px bg-border" />

					{events.map((event) => {
						const payloadSummary = formatPayloadSummary(
							event.eventType,
							event.payload
						);
						const isEditable = !NON_EDITABLE_EVENTS.has(event.eventType);

						return (
							<div className="relative flex gap-3 pb-4" key={event.id}>
								{/* Time column */}
								<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
									{formatTime(event.occurredAt)}
								</div>

								{/* Dot */}
								<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />

								{/* Content */}
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<div>
											<span className="font-medium text-sm">
												{formatEventLabel(event.eventType)}
											</span>
											{payloadSummary && (
												<p className="mt-0.5 text-muted-foreground text-xs">
													{payloadSummary}
												</p>
											)}
											<EventDetail
												eventType={event.eventType}
												payload={event.payload}
											/>
										</div>
										{isEditable && (
											<div className="flex shrink-0 gap-1">
												<Button
													onClick={() => setEditEvent(event)}
													size="icon-xs"
													variant="ghost"
												>
													<IconPencil size={14} />
												</Button>
												<Button
													onClick={() => deleteMutation.mutate(event.id)}
													size="icon-xs"
													variant="ghost"
												>
													<IconTrash size={14} />
												</Button>
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Edit dialog */}
			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditEvent(null);
					}
				}}
				open={editEvent !== null}
				title={`Edit ${editEvent ? formatEventLabel(editEvent.eventType) : ""}`}
			>
				{editEvent &&
					(editEvent.eventType === "stack_record" ? (
						<StackRecordEditor
							initialOccurredAt={editEvent.occurredAt}
							initialPayload={{
								stackAmount:
									(editEvent.payload as { stackAmount?: number })
										?.stackAmount ?? 0,
								allIns: Array.isArray(
									(editEvent.payload as { allIns?: unknown })?.allIns
								)
									? ((editEvent.payload as { allIns: unknown[] })
											.allIns as Array<{
											equity: number;
											potSize: number;
											trials: number;
											wins: number;
										}>)
									: [],
							}}
							isLoading={updateMutation.isPending}
							onDelete={() => deleteMutation.mutate(editEvent.id)}
							onSubmit={(payload, occurredAt) =>
								updateMutation.mutate({
									id: editEvent.id,
									payload,
									occurredAt,
								})
							}
						/>
					) : (
						<AmountEditor
							event={editEvent}
							isLoading={updateMutation.isPending}
							onDelete={() => deleteMutation.mutate(editEvent.id)}
							onSubmit={handleUpdate}
						/>
					))}
			</ResponsiveDialog>
		</div>
	);
}
