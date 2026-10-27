import { useState } from "react";
import { UPDATE_NOTES } from "@/features/update-notes/constants";
import { useUpdateNotesSheet } from "./use-update-notes-sheet";

export function useUpdateNotesReleases() {
	const { isOpen, markViewed, setIsOpen, viewedVersions } =
		useUpdateNotesSheet();
	const [expandedVersions, setExpandedVersions] = useState<ReadonlySet<string>>(
		new Set()
	);

	const onToggleRelease = (version: string) => {
		const next = new Set(expandedVersions);
		if (next.has(version)) {
			next.delete(version);
		} else {
			next.add(version);
			markViewed(version);
		}
		setExpandedVersions(next);
	};

	return {
		isOpen,
		onOpenChange: setIsOpen,
		onToggleRelease,
		releases: UPDATE_NOTES.map((note) => ({
			...note,
			isExpanded: expandedVersions.has(note.version),
			isNew: !viewedVersions.has(note.version),
			releasedOn: note.releasedAt.replaceAll("-", "/"),
		})),
	};
}
