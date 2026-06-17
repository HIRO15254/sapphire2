import { useState } from "react";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { useSessionFormState } from "./use-session-form-state";

export type WizardStep = "master" | "rules" | "result" | "start";
export type WizardMode = "manual" | "live";

const WIZARD_STEPS_MANUAL: ReadonlyArray<{ key: WizardStep; label: string }> = [
	{ key: "master", label: "Master" },
	{ key: "rules", label: "Rules" },
	{ key: "result", label: "Result" },
];

const WIZARD_STEPS_LIVE: ReadonlyArray<{ key: WizardStep; label: string }> = [
	{ key: "master", label: "Master" },
	{ key: "rules", label: "Rules" },
	{ key: "start", label: "Start" },
];

export function wizardStepsForMode(
	mode: WizardMode
): ReadonlyArray<{ key: WizardStep; label: string }> {
	return mode === "live" ? WIZARD_STEPS_LIVE : WIZARD_STEPS_MANUAL;
}

// Retained for backwards compatibility with existing callers / tests.
export const WIZARD_STEPS = WIZARD_STEPS_MANUAL;

interface UseSessionWizardArgs {
	defaultValues?: SessionFormDefaults;
	mode?: WizardMode;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

export function useSessionWizard(args: UseSessionWizardArgs) {
	const mode: WizardMode = args.mode ?? "manual";
	const steps = wizardStepsForMode(mode);
	const [currentStep, setCurrentStep] = useState<WizardStep>("master");
	const formState = useSessionFormState(args);

	const stepIndex = steps.findIndex((s) => s.key === currentStep);
	const isFirstStep = stepIndex === 0;
	const isLastStep = stepIndex === steps.length - 1;

	const goToNext = () => {
		const next = steps[stepIndex + 1];
		if (next) {
			setCurrentStep(next.key);
		}
	};

	const goToPrev = () => {
		const prev = steps[stepIndex - 1];
		if (prev) {
			setCurrentStep(prev.key);
		}
	};

	/**
	 * Wraps `form.handleSubmit` with a live-mode guard: if the wizard is on
	 * the "start" step, the session type is cash, and the buyIn field is empty,
	 * the submit is aborted and a "Required" error is placed on the buyIn field
	 * instead of submitting a session with buyIn = 0.
	 *
	 * When buyIn is non-empty, any manually-placed "Required" error from a prior
	 * failed attempt is cleared so that `isValid` resets to `true` before
	 * `form.handleSubmit()` checks `canSubmit`.
	 */
	const handleFormSubmit = () => {
		if (mode === "live" && currentStep === "start" && formState.isCashGame) {
			if (formState.form.getFieldValue("buyIn") === "") {
				formState.form.setFieldMeta("buyIn", (prev) => ({
					...prev,
					errorMap: { ...prev?.errorMap, onSubmit: [{ message: "Required" }] },
				}));
				return;
			}
			formState.form.setFieldMeta("buyIn", (prev) => ({
				...prev,
				errorMap: { ...prev?.errorMap, onSubmit: undefined },
			}));
		}
		formState.form.handleSubmit();
	};

	return {
		...formState,
		mode,
		steps,
		currentStep,
		setCurrentStep,
		stepIndex,
		isFirstStep,
		isLastStep,
		goToNext,
		goToPrev,
		handleFormSubmit,
	};
}

export type UseSessionWizardReturn = ReturnType<typeof useSessionWizard>;
