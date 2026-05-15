import { useState } from "react";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { useSessionFormState } from "./use-session-form-state";

export type WizardStep = "master" | "rules" | "result";

export const WIZARD_STEPS: ReadonlyArray<{ key: WizardStep; label: string }> = [
	{ key: "master", label: "Master" },
	{ key: "rules", label: "Rules" },
	{ key: "result", label: "Result" },
];

interface UseSessionWizardArgs {
	defaultValues?: SessionFormDefaults;
	onStoreChange?: (storeId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

export function useSessionWizard(args: UseSessionWizardArgs) {
	const [currentStep, setCurrentStep] = useState<WizardStep>("master");
	const formState = useSessionFormState(args);

	const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
	const isFirstStep = stepIndex === 0;
	const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

	const goToNext = () => {
		const next = WIZARD_STEPS[stepIndex + 1];
		if (next) {
			setCurrentStep(next.key);
		}
	};

	const goToPrev = () => {
		const prev = WIZARD_STEPS[stepIndex - 1];
		if (prev) {
			setCurrentStep(prev.key);
		}
	};

	return {
		...formState,
		currentStep,
		setCurrentStep,
		stepIndex,
		isFirstStep,
		isLastStep,
		goToNext,
		goToPrev,
	};
}

export type UseSessionWizardReturn = ReturnType<typeof useSessionWizard>;
