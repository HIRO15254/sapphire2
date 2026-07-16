import { createContext, useContext, useEffect, useState } from "react";
import { LATEST_VERSION } from "@/features/update-notes/constants";
import { useUpdateNotesViewed } from "@/features/update-notes/hooks/use-update-notes-viewed";
import { shouldAutoOpenUpdateNotes } from "@/features/update-notes/utils/should-auto-open-update-notes";

interface UpdateNotesSheetContextValue {
	close: () => void;
	isOpen: boolean;
	onAccordionChange: (value: string[]) => void;
	open: () => void;
	setIsOpen: (open: boolean) => void;
	viewedVersions: ReadonlySet<string>;
}

const UpdateNotesSheetContext =
	createContext<UpdateNotesSheetContextValue | null>(null);

export function UpdateNotesProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [hasAutoOpened, setHasAutoOpened] = useState(false);
	// Single source of truth for viewed state, shared with UpdateNotesSheet via
	// context. Holding one instance here (rather than the provider and the sheet
	// each calling useUpdateNotesViewed) keeps the auto-open optimistic mark in
	// sync with the sheet's NEW badges — no cross-instance flicker (SA2-185).
	const {
		viewedVersions,
		isViewedListLoaded,
		markViewed,
		handleAccordionChange,
	} = useUpdateNotesViewed();

	useEffect(() => {
		// Wait until the viewed list has loaded before deciding once.
		if (hasAutoOpened || !isViewedListLoaded) {
			return;
		}

		if (
			shouldAutoOpenUpdateNotes({
				latestVersion: LATEST_VERSION,
				viewedVersions: [...viewedVersions],
			})
		) {
			setIsOpen(true);
			// Record the latest release as viewed on auto-open so the sheet
			// surfaces once per release instead of every session until the user
			// happens to expand its accordion (SA2-185 review follow-up).
			if (LATEST_VERSION) {
				markViewed(LATEST_VERSION);
			}
		}
		setHasAutoOpened(true);
	}, [isViewedListLoaded, viewedVersions, hasAutoOpened, markViewed]);

	return (
		<UpdateNotesSheetContext.Provider
			value={{
				isOpen,
				open: () => setIsOpen(true),
				close: () => setIsOpen(false),
				setIsOpen,
				viewedVersions,
				onAccordionChange: handleAccordionChange,
			}}
		>
			{children}
		</UpdateNotesSheetContext.Provider>
	);
}

export function useUpdateNotesSheet() {
	const ctx = useContext(UpdateNotesSheetContext);
	if (!ctx) {
		throw new Error(
			"useUpdateNotesSheet must be used within UpdateNotesProvider"
		);
	}
	return ctx;
}
