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
	/** Stable id linking the sheet's confirm button to this form. */
	formId: string;
	/**
	 * `true` when the session was recorded live. Manual and live sessions share
	 * the exact same form layout; for live sessions the fields derived from the
	 * event history are disabled (only room, currency, tags and memo — the
	 * metadata `session.update` accepts for a live session — stay editable), and
	 * the live event history is exposed for editing in the Events section.
	 */
	isLiveLinked?: boolean;
	/** Live-session id backing this record — enables the Events section. */
	liveSessionId?: string;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	rooms?: Array<{ id: string; name: string }>;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

/**
 * Single-screen post-edit form for a completed session, rendered inside the
 * shared `FormSheet` (its `[✓]` button submits this form via `form={formId}`).
 * Manual and live-recorded sessions use one shared structure: Master and Result
 * stay open, Rules is a collapsible section, and — for live sessions only — an
 * Events section exposes the underlying event history for editing. For a live
 * session the event-derived fields render disabled rather than hidden.
 */
export function SessionEditForm({
	currencies,
	defaultValues,
	formId,
	isLiveLinked = false,
	liveSessionId,
	onCreateTag,
	onRoomChange,
	onSubmit,
	ringGames,
	rooms,
	tags,
	tournaments,
}: SessionEditFormProps) {
	const { state } = useSessionEditForm({
		defaultValues,
		onRoomChange,
		onSubmit,
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
						This session is generated from a live session. Items calculated from
						event history cannot be edited directly — edit them in the Events
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
					isLiveLinked={isLiveLinked}
					onCreateTag={onCreateTag}
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
