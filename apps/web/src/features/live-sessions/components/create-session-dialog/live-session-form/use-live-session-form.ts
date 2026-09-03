import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSessionWizard } from "@/features/sessions/components/session-wizard/use-session-wizard";
import type {
	RingGameOption,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface UseLiveSessionFormArgs {
	defaultRoomId?: string;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

export function useLiveSessionForm({
	defaultRoomId,
	onRoomChange,
	onSubmit,
	ringGames,
	tournaments,
}: UseLiveSessionFormArgs) {
	const state = useSessionWizard({
		mode: "live",
		defaultRoomId,
		onRoomChange,
		onSubmit,
		ringGames,
		tournaments,
	});

	const [rulesOpen, setRulesOpen] = useState(false);

	useEffect(() => {
		if (state.currentStep === "rules") {
			setRulesOpen(true);
		}
	}, [state.currentStep]);

	const selectedMaster = state.isCashGame
		? state.selectedRingGame
		: state.selectedTournament;
	const rulesSummary = selectedMaster?.name;

	const onFormSubmit = (event: FormEvent) => {
		event.preventDefault();
		event.stopPropagation();
		state.form.handleSubmit();
	};

	return { state, rulesOpen, setRulesOpen, rulesSummary, onFormSubmit };
}
