import { useUpdateNotesSheet } from "@/features/update-notes/components/update-notes-sheet";
import { LATEST_VERSION } from "@/features/update-notes/constants";

export function useAboutSection() {
	const { open } = useUpdateNotesSheet();

	return {
		version: LATEST_VERSION,
		onViewUpdateNotes: open,
	};
}
