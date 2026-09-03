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
	requiredFields?: ReadonlySet<string>;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

export function useSessionEditForm(args: UseSessionEditFormArgs) {
	const state = useSessionWizard({ ...args, mode: "manual" });
	return { state };
}

export type UseSessionEditFormReturn = ReturnType<typeof useSessionEditForm>;
