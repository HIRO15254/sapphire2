import { useSessionWizard } from "@/features/sessions/components/session-wizard/use-session-wizard";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface UseSessionEditFormArgs {
	defaultValues?: SessionFormDefaults;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

/**
 * Form-state hook for the post-edit sheet. Reuses the wizard's proven form
 * state (`buildDefaults` seeding + the `SessionFormValues` submit mapping) via
 * {@link useSessionWizard} in `manual` mode, but the edit form renders every
 * field on one screen, so the returned nav helpers (currentStep / goToNext …)
 * go unused. Session type is fixed by `defaultValues.type` — the update
 * procedure keys off the persisted `kind`, so the edit form never switches it.
 */
export function useSessionEditForm(args: UseSessionEditFormArgs) {
	const state = useSessionWizard({ ...args, mode: "manual" });
	return { state };
}

export type UseSessionEditFormReturn = ReturnType<typeof useSessionEditForm>;
