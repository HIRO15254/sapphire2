import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";
import { RoomGameSelectors } from "@/features/sessions/components/session-wizard/master-step-body/link-selectors";
import { ResultStepBody } from "@/features/sessions/components/session-wizard/result-step-body";
import { RulesStepBody } from "@/features/sessions/components/session-wizard/rules-step-body";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { InputGroup } from "@/shared/components/ui/input-group";
import { useSessionEditForm } from "./use-session-edit-form";

interface SessionEditFormProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	/**
	 * Result fields to render read-only. For a live session this is the set of
	 * values aggregated over several events (buy-in, EV cash-out, break time, …);
	 * the fields backed by a single event value stay editable and are written
	 * back to that event on save. Empty for a manual session.
	 */
	disabledFields?: ReadonlySet<string>;
	/**
	 * Calendar day the end time writes to, when it is not the date shown in the
	 * form — the session crossed midnight, or (for a live session) the displayed
	 * date lags the times. Rendered under the End time field.
	 */
	endDateHint?: string | null;
	/** Stable id linking the sheet's confirm button to this form. */
	formId: string;
	/**
	 * `true` when the session was recorded live. Manual and live sessions share
	 * the exact same form layout; for live sessions the Master and Rules fields
	 * (frozen rule snapshots with no backing event) are disabled, the Result
	 * fields follow `disabledFields`, and the event history is exposed for
	 * editing in the Events section.
	 */
	isLiveLinked?: boolean;
	/** Live-session id backing this record — enables the Events section. */
	liveSessionId?: string;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	/**
	 * Result fields to mark and validate as required. For a live session these
	 * are the fields written back to an existing event, where a blank is
	 * rejected — the shared schema keeps them optional for manual sessions.
	 */
	requiredFields?: ReadonlySet<string>;
	ringGames?: RingGameOption[];
	rooms?: Array<{ id: string; name: string }>;
	/** Same as {@link endDateHint}, for the Start time field. */
	startDateHint?: string | null;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

/**
 * Single-screen post-edit form for a completed session, rendered inside the
 * shared `FormSheet` (its `[✓]` button submits this form via `form={formId}`).
 * Manual and live-recorded sessions use one shared structure: Master and Result
 * stay open, Rules is a collapsible section, and — for live sessions only — an
 * Events section exposes the underlying event history for editing. A live
 * session renders its locked fields disabled rather than hidden.
 */
export function SessionEditForm({
	currencies,
	defaultValues,
	disabledFields,
	endDateHint,
	formId,
	isLiveLinked = false,
	liveSessionId,
	onCreateTag,
	onRoomChange,
	onSubmit,
	requiredFields,
	ringGames,
	rooms,
	startDateHint,
	tags,
	tournaments,
}: SessionEditFormProps) {
	const { state } = useSessionEditForm({
		defaultValues,
		onRoomChange,
		onSubmit,
		requiredFields,
		ringGames,
		tournaments,
	});
	const showEvents = isLiveLinked && Boolean(liveSessionId);

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				state.form.handleSubmit();
			}}
		>
			{isLiveLinked && (
				<Alert data-testid="live-linked-banner">
					<AlertDescription>
						This session is generated from a live session. Time and result
						fields sync back to the event history when you save; values
						calculated from several events can only be changed in the Events
						section below.
					</AlertDescription>
				</Alert>
			)}

			<InputGroup label="Master">
				<RoomGameSelectors
					gameLabel={state.gameLabel}
					gameOptions={state.gameOptions}
					isLiveLinked={isLiveLinked}
					onGameChange={state.handleGameChange}
					onRoomChange={state.handleRoomChange}
					rooms={rooms}
					selectedGameId={state.selectedGameId}
					selectedRoomId={state.selectedRoomId}
				/>
			</InputGroup>

			<InputGroup label="Result">
				<ResultStepBody
					disabledFields={disabledFields}
					endDateHint={endDateHint}
					onCreateTag={onCreateTag}
					requiredFields={requiredFields}
					startDateHint={startDateHint}
					state={state}
					tags={tags}
				/>
			</InputGroup>

			<Accordion type="multiple">
				<AccordionItem className="border-t" value="rules">
					<AccordionTrigger>Rules</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-3">
						<RulesStepBody
							currencies={currencies}
							isLiveLinked={isLiveLinked}
							showOverrides={false}
							state={state}
						/>
					</AccordionContent>
				</AccordionItem>

				{showEvents && liveSessionId ? (
					<AccordionItem value="events">
						<AccordionTrigger>Events</AccordionTrigger>
						<AccordionContent>
							<SessionEventsScene
								embedded
								sessionId={liveSessionId}
								sessionType={state.sessionType}
							/>
						</AccordionContent>
					</AccordionItem>
				) : null}
			</Accordion>
		</form>
	);
}
