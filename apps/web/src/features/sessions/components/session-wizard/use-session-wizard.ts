import { useEffect, useState } from "react";
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

const RULE_FIELDS = new Set([
	"ruleName",
	"variant",
	"blind1",
	"blind2",
	"blind3",
	"ante",
	"anteType",
	"tableSize",
	"minBuyIn",
	"maxBuyIn",
	"tournamentBuyIn",
	"entryFee",
	"startingStack",
	"bountyAmount",
]);

export function firstInvalidWizardStep(
	fieldNames: string[],
	mode: WizardMode
): WizardStep | null {
	if (fieldNames.some((fieldName) => RULE_FIELDS.has(fieldName))) {
		return "rules";
	}
	if (fieldNames.length === 0) {
		return null;
	}
	return mode === "live" ? "start" : "result";
}

export function wizardStepsForMode(
	mode: WizardMode
): ReadonlyArray<{ key: WizardStep; label: string }> {
	return mode === "live" ? WIZARD_STEPS_LIVE : WIZARD_STEPS_MANUAL;
}

// Retained for backwards compatibility with existing callers / tests.
export const WIZARD_STEPS = WIZARD_STEPS_MANUAL;

interface UseSessionWizardArgs {
	defaultRoomId?: string;
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
	useEffect(() => {
		if (!steps.some((step) => step.key === currentStep)) {
			setCurrentStep("master");
		}
	}, [currentStep, steps]);
	const formState = useSessionFormState({
		...args,
		onSubmitInvalid: (fieldNames) => {
			const invalidStep = firstInvalidWizardStep(fieldNames, mode);
			setCurrentStep(invalidStep ?? currentStep);
		},
	});

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
		onSubmitHandler: formState.form.handleSubmit,
	};
}

export type UseSessionWizardReturn = ReturnType<typeof useSessionWizard>;
