import type { FormEvent } from "react";
import { useState } from "react";
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

/**
 * Drives the single-screen live-session form. It reuses the wizard's form
 * state (`useSessionWizard` in "live" mode) for field rendering, master
 * pre-fill and submit shaping, but ignores the step navigation — the form is
 * laid out on one screen with the rule overrides behind a collapsible.
 */
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

	// Progressive disclosure: rule overrides stay collapsed by default — a
	// session that keeps the master's rules starts without opening them. The
	// user expands the section only to tweak the rules.
	const [rulesOpen, setRulesOpen] = useState(false);

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
