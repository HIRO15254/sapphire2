import { IconChevronLeft, IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StackRecordEditor } from "@/components/live-sessions/stack-record-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute(
	"/live-sessions/cash-game/$sessionId/events"
)({
	component: CashGameEventsPage,
});

const EVENT_TYPE_LABELS: Record<string, string> = {
	chip_add: "Chip Add",
	stack_record: "Stack Record",
	player_join: "Player Join",
	player_leave: "Player Leave",
	session_start: "Session Start",
	session_end: "Session End",
};

function formatEventLabel(eventType: string): string {
	return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatTime(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
				{hasAllIns && <AllInsDetail allIns={p.allIns as unknown[]} />}
			</div>
		);
	}

	return null;
}

// Simple editor for non-stack events (buy-in, cash-out, etc.)
function SimpleEventEditor({
	event,
	isLoading,
	onDelete: handleDelete,
	onSubmit,
}: {
	event: SessionEvent;
	isLoading: boolean;
	onDelete: () => void;
	onSubmit: (payload: unknown) => void;
}) {
	const p = (event.payload ?? {}) as Record<string, unknown>;

	// chip_add: just amount
	if (event.eventType === "chip_add" && typeof p.amount === "number") {
		const [amount, setAmount] = useState(String(p.amount));
		return (
			<div className="flex flex-col gap-4">
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
						onClick={() => onSubmit({ amount: Number(amount) })}
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

	// Fallback: JSON editor
	const [value, setValue] = useState(JSON.stringify(event.payload, null, 2));
	const [parseError, setParseError] = useState<string | null>(null);

	const handleSave = () => {
		setParseError(null);
		try {
			const parsed = JSON.parse(value);
			onSubmit(parsed);
		} catch (err) {
			setParseError(err instanceof Error ? err.message : "Invalid JSON");
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="event-payload">Payload (JSON)</Label>
				<textarea
					className="h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					id="event-payload"
					onChange={(e) => setValue(e.target.value)}
					value={value}
				/>
				{parseError && <p className="text-destructive text-xs">{parseError}</p>}
			</div>
			<div className="flex flex-col gap-2">
				<Button disabled={isLoading} onClick={handleSave} type="button">
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={handleDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>
		</div>
	);
}

function CashGameEventsPage() {
	const { sessionId } = Route.useParams();
	const queryClient = useQueryClient();

	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);

	const eventsQuery = useQuery(
		trpc.sessionEvent.list.queryOptions({ liveCashGameSessionId: sessionId })
	);
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
		mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
			trpcClient.sessionEvent.update.mutate({ id, payload }),
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

	return (
		<div className="p-4 md:p-6">
			{/* Header */}
			<div className="mb-4 flex items-center gap-3">
				<Button asChild size="sm" variant="ghost">
					<Link params={{ sessionId }} to="/live-sessions/cash-game/$sessionId">
						<IconChevronLeft size={16} />
						Back
					</Link>
				</Button>
			</div>

			<div className="mb-6 flex flex-wrap items-center gap-2">
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
							initialPayload={
								editEvent.payload as {
									allIns: Array<{
										equity: number;
										potSize: number;
										trials: number;
										wins: number;
									}>;
									stackAmount: number;
								}
							}
							isLoading={updateMutation.isPending}
							onDelete={() => deleteMutation.mutate(editEvent.id)}
							onSubmit={(payload) =>
								updateMutation.mutate({ id: editEvent.id, payload })
							}
						/>
					) : (
						<SimpleEventEditor
							event={editEvent}
							isLoading={updateMutation.isPending}
							onDelete={() => deleteMutation.mutate(editEvent.id)}
							onSubmit={(payload) =>
								updateMutation.mutate({ id: editEvent.id, payload })
							}
						/>
					))}
			</ResponsiveDialog>
		</div>
	);
}
