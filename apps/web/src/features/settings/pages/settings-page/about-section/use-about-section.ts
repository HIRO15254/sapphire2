import { useUpdateNotesSheet } from "@/features/update-notes/components/update-notes-sheet";
import { LATEST_VERSION } from "@/features/update-notes/constants";

export function useAboutSection() {
	const { open, viewedVersions } = useUpdateNotesSheet();

	return {
		hasUnviewedNotes:
			LATEST_VERSION !== null && !viewedVersions.has(LATEST_VERSION),
		version: LATEST_VERSION,
		onViewUpdateNotes: open,
	};
}
