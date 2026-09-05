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
	const {
		viewedVersions,
		isViewedListLoaded,
		markViewed,
		handleAccordionChange,
	} = useUpdateNotesViewed();

	useEffect(() => {
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
