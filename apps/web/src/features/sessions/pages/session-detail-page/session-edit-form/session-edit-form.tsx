import { RoomGameSelectors } from "@/features/sessions/components/session-wizard/master-step-body/link-selectors";
import { ResultStepBody } from "@/features/sessions/components/session-wizard/result-step-body";
import { RulesStepBody } from "@/features/sessions/components/session-wizard/rules-step-body";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
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
	 * metadata `session.update` accepts for a live session — stay editable).
	 */
	isLiveLinked?: boolean;
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
 * Manual and live-recorded sessions use one shared structure — the wizard's
 * Master / Rules / Result field bodies grouped as `InputGroup` sections (no
 * stepper). For a live session the event-derived fields render disabled rather
 * than being hidden, so the form reads the same either way.
 */
export function SessionEditForm({
	currencies,
	defaultValues,
	formId,
	isLiveLinked = false,
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
						event history cannot be edited. To modify them, edit the events in
						the live session.
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

			<InputGroup label="Rules">
				<RulesStepBody
					currencies={currencies}
					isLiveLinked={isLiveLinked}
					showOverrides={false}
					state={state}
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
		</form>
	);
}
