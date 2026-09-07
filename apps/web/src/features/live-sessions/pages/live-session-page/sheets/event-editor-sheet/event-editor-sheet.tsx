import { IconTrash } from "@tabler/icons-react";
import type { EventEditorKind } from "@/features/live-sessions/utils/timeline-view";
import {
	EVENT_TONE_TEXT,
	resolveEventIcon,
	resolveKindTone,
} from "../../event-visuals";
import { CrystFormSheet } from "../cryst-form-sheet";
import {
	AllInFields,
	ChipsFields,
	MemoFields,
	PurchaseFields,
	SeatFields,
	StackFields,
	StartFields,
	TimeField,
} from "./editor-fields";
import type {
	ChipPurchaseOption,
	EventEditorSubmit,
	EventEditorTarget,
} from "./use-event-editor-sheet";
import { useEventEditorSheet } from "./use-event-editor-sheet";

const FORM_ID = "cryst-event-editor-form";

export const NEW_EVENT_TITLES: Record<EventEditorKind, string> = {
	allin: "All-in (EV log)",
	chips: "Chip adjust",
	end: "Session end",
	memo: "Note",
	purchase: "Chip purchase",
	seat: "Player seating",
	stack: "Stack update",
	start: "Session start",
	time: "Timer",
};

const KIND_HINTS: Partial<Record<EventEditorKind, string>> = {
	allin:
		"Wins cannot exceed runs. A chop can be logged as 0.5 wins. EV delta feeds into EV result.",
	chips:
		"Additions count toward total buy-in; withdrawals count toward the result.",
	purchase:
		"Name, cost and chips are snapshotted at selection, and the cost feeds into the result.",
	seat: "Moving the seat also moves the player at the table. Which player this event belongs to is set from the table.",
	stack: "Stack is recorded as an absolute value, not a delta.",
};

interface EventEditorSheetProps {
	chipPurchaseOptions: ChipPurchaseOption[];
	isPending: boolean;
	isTournament: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	occupiedSeatPositions: ReadonlySet<number>;
	onDelete: (() => void) | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: EventEditorSubmit) => void;
	open: boolean;
	playerNames: ReadonlyMap<string, string>;
	seatCount: number;
	target: EventEditorTarget;
}

export function EventEditorSheet({
	chipPurchaseOptions,
	isPending,
	isTournament,
	maxTime,
	minTime,
	occupiedSeatPositions,
	onDelete,
	onOpenChange,
	onSubmit,
	open,
	playerNames,
	seatCount,
	target,
}: EventEditorSheetProps) {
	const { form, isSeatEditable, playerLabel, timeValidator } =
		useEventEditorSheet({
			chipPurchaseOptions,
			isTournament,
			maxTime,
			minTime,
			occupiedSeatPositions,
			onSubmit,
			playerNames,
			seatCount,
			target,
		});

	const KindIcon = resolveEventIcon(target.kind, target.event?.eventType);
	const tone = EVENT_TONE_TEXT[resolveKindTone(target.kind)];
	const hint = KIND_HINTS[target.kind];
	const isEdit = target.mode === "edit";

	return (
		<CrystFormSheet
			className="h-auto max-h-[calc(100svh-2rem)]"
			formId={FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={isEdit ? "Edit event" : NEW_EVENT_TITLES[target.kind]}
		>
			<form
				className="grid grid-cols-6 items-end gap-x-2 gap-y-3"
				id={FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<p className="col-span-6 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-[length:var(--text-xs)]">
					<KindIcon className={tone} size={15} />
					<span className="font-semibold">{target.label}</span>
					<span className="text-muted-foreground">
						{isEdit ? "· type cannot be changed" : "· new event"}
					</span>
				</p>

				<TimeField form={form} timeValidator={timeValidator} />

				{target.kind === "stack" ? (
					<StackFields form={form} isTournament={isTournament} />
				) : null}
				{target.kind === "allin" ? <AllInFields form={form} /> : null}
				{target.kind === "chips" ? <ChipsFields form={form} /> : null}
				{target.kind === "memo" ? <MemoFields form={form} /> : null}
				{target.kind === "purchase" ? (
					<PurchaseFields form={form} options={chipPurchaseOptions} />
				) : null}
				{target.kind === "seat" ? (
					<SeatFields
						form={form}
						isSeatEditable={isSeatEditable}
						playerLabel={playerLabel}
					/>
				) : null}
				{target.kind === "start" ? (
					<StartFields form={form} isTournament={isTournament} />
				) : null}

				{hint === undefined ? null : (
					<p className="col-span-6 text-pretty text-[length:var(--text-xs)] text-muted-foreground">
						{hint}
					</p>
				)}
			</form>

			{onDelete === null ? null : (
				<div className="mt-4 border-border border-t pt-3">
					<button
						className="inline-flex min-h-[var(--m-control)] w-full items-center justify-center gap-1.5 rounded-md border border-destructive bg-transparent font-medium text-[length:var(--text-sm)] text-destructive disabled:opacity-50"
						disabled={isPending}
						onClick={onDelete}
						type="button"
					>
						<IconTrash size={15} />
						Delete this event
					</button>
				</div>
			)}
		</CrystFormSheet>
	);
}
