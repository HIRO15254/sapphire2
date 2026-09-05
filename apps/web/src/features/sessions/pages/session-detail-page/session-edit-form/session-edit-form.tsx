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
	disabledFields?: ReadonlySet<string>;
	endDateHint?: string | null;
	formId: string;
	isLiveLinked?: boolean;
	liveSessionId?: string;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	requiredFields?: ReadonlySet<string>;
	ringGames?: RingGameOption[];
	rooms?: Array<{ id: string; name: string }>;
	startDateHint?: string | null;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

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
