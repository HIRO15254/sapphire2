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

interface WizardStepDef {
	key: WizardStep;
	label: string;
}

const WIZARD_STEPS_MANUAL: readonly WizardStepDef[] = [
	{ key: "master", label: "Master" },
	{ key: "rules", label: "Rules" },
	{ key: "result", label: "Result" },
];

// Live mode drops the Rules step from the default flow: when a master (ring
// game / tournament) is picked it already supplies the rules, so the user can
// reach Start in a single tap ("speedy start"). The Rules step is added back
// only when no master is selected (rules must then be defined from scratch) or
// when the user explicitly opts to customize them via `customizeRules`.
const WIZARD_STEPS_LIVE_FAST: readonly WizardStepDef[] = [
	{ key: "master", label: "Master" },
	{ key: "start", label: "Start" },
];

const WIZARD_STEPS_LIVE_FULL: readonly WizardStepDef[] = [
	{ key: "master", label: "Master" },
	{ key: "rules", label: "Rules" },
	{ key: "start", label: "Start" },
];

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
	const [currentStep, setCurrentStep] = useState<WizardStep>("master");
	const [rulesCustomized, setRulesCustomized] = useState(false);
	const formState = useSessionFormState(args);

	// In live mode the Rules step is part of the flow only when no master is
	// selected (so its rules can't be inherited) or the user opted to customize.
	const liveIncludesRules = rulesCustomized || !formState.selectedGameId;
	let steps: readonly WizardStepDef[];
	if (mode === "live") {
		steps = liveIncludesRules ? WIZARD_STEPS_LIVE_FULL : WIZARD_STEPS_LIVE_FAST;
	} else {
		steps = WIZARD_STEPS_MANUAL;
	}

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

	// Live-mode fast path only: pull the Rules step into the flow and jump to it
	// so the user can override the master's rules. The affordance disappears
	// once customizing (the Rules step is then a normal part of the flow).
	const canCustomizeRules = mode === "live" && !liveIncludesRules;
	const customizeRules = () => {
		setRulesCustomized(true);
		setCurrentStep("rules");
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
		canCustomizeRules,
		customizeRules,
	};
}

export type UseSessionWizardReturn = ReturnType<typeof useSessionWizard>;
