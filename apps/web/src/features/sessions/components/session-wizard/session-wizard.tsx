import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { MasterStepBody } from "./master-step-body";
import { ResultStepBody } from "./result-step-body";
import { RulesStepBody } from "./rules-step-body";
import { StartStepBody } from "./start-step-body";
import { StepperBar } from "./stepper-bar";
import { useSessionWizard, type WizardMode } from "./use-session-wizard";

export type {
	CashGameFormValues,
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface SessionWizardProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	isLiveLinked?: boolean;
	isLoading?: boolean;
	/**
	 * "manual" (default) renders all three steps and submits to
	 * session.create / session.update. "live" drops the Result step
	 * (because live sessions populate results from events) and labels
	 * the final action "Start session" — the caller still receives the
	 * accumulated form values via `onSubmit`.
	 */
	mode?: WizardMode;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	rooms?: Array<{ id: string; name: string }>;
	submitLabel?: string;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

export function SessionWizard({
	currencies,
	defaultValues,
	isLiveLinked = false,
	isLoading = false,
	mode = "manual",
	onCreateTag,
	onRoomChange,
	onSubmit,
	ringGames,
	rooms,
	submitLabel,
	tags,
	tournaments,
}: SessionWizardProps) {
	const state = useSessionWizard({
		defaultValues,
		mode,
		onRoomChange,
		onSubmit,
		ringGames,
		tournaments,
	});
	const finalSubmitLabel = submitLabel ?? (mode === "live" ? "Start" : "Save");

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				state.handleFormSubmit();
			}}
		>
			{isLiveLinked && (
				<Alert data-testid="live-linked-banner">
					<AlertDescription>
						This session is generated from a live session. Items calculated from
						event history cannot be edited. To modify, edit the events in the
						live session.
					</AlertDescription>
				</Alert>
			)}

			<StepperBar currentStep={state.currentStep} steps={state.steps} />

			<div className="flex flex-col gap-3">
				{state.currentStep === "master" && (
					<MasterStepBody
						isLiveLinked={isLiveLinked}
						rooms={rooms}
						state={state}
					/>
				)}
				{state.currentStep === "rules" && (
					<RulesStepBody
						currencies={currencies}
						isLiveLinked={isLiveLinked}
						state={state}
					/>
				)}
				{state.currentStep === "result" && (
					<ResultStepBody
						isLiveLinked={isLiveLinked}
						onCreateTag={onCreateTag}
						state={state}
						tags={tags}
					/>
				)}
				{state.currentStep === "start" && <StartStepBody state={state} />}
			</div>

			<div className="mt-2 flex items-center justify-between gap-2">
				<Button
					disabled={state.isFirstStep}
					onClick={state.goToPrev}
					type="button"
					variant="outline"
				>
					<IconChevronLeft size={14} />
					Back
				</Button>
				{state.isLastStep ? (
					<state.form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<Button
								disabled={isLoading || !canSubmit || isSubmitting}
								type="submit"
							>
								{isLoading ? `${finalSubmitLabel}...` : finalSubmitLabel}
							</Button>
						)}
					</state.form.Subscribe>
				) : (
					<Button onClick={state.goToNext} type="button">
						Next
						<IconChevronRight size={14} />
					</Button>
				)}
			</div>
		</form>
	);
}
