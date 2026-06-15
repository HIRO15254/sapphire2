import type { FormEvent } from "react";
import { useState } from "react";
import { useSessionWizard } from "@/features/sessions/components/session-wizard/use-session-wizard";
import type {
	RingGameOption,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface UseLiveSessionFormArgs {
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

/**
 * Drives the single-screen live-session form. It reuses the wizard's form
 * state (`useSessionWizard` in "live" mode) for field rendering, master
 * pre-fill and submit shaping, but ignores the step navigation — the form is
 * laid out on one screen with the rule overrides behind a collapsible.
 */
export function useLiveSessionForm({
	onRoomChange,
	onSubmit,
	ringGames,
	tournaments,
}: UseLiveSessionFormArgs) {
	const state = useSessionWizard({
		mode: "live",
		onRoomChange,
		onSubmit,
		ringGames,
		tournaments,
	});

	// Progressive disclosure: rule overrides stay collapsed when a master (ring
	// game / tournament) supplies them, and auto-open when none is selected (the
	// rules must then be defined from scratch). A manual toggle pins the state.
	const [manualRulesOpen, setManualRulesOpen] = useState<boolean | null>(null);
	const rulesOpen = manualRulesOpen ?? !state.selectedGameId;
	const setRulesOpen = (open: boolean) => setManualRulesOpen(open);

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
