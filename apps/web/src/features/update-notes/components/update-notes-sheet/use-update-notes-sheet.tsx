import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { LATEST_VERSION } from "@/features/update-notes/constants";
import { trpc } from "@/utils/trpc";

interface UpdateNotesSheetContextValue {
	close: () => void;
	isOpen: boolean;
	open: () => void;
	setIsOpen: (open: boolean) => void;
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

	const { data: latestViewed } = useQuery(
		trpc.updateNoteView.getLatestViewedVersion.queryOptions()
	);

	useEffect(() => {
		if (hasAutoOpened || !latestViewed || !LATEST_VERSION) {
			return;
		}

		// First-time user (never viewed any version) — skip auto-open
		if (latestViewed.version === null) {
			setHasAutoOpened(true);
			return;
		}

		// User has viewed before but not the latest version — auto-open
		if (latestViewed.version === LATEST_VERSION) {
			setHasAutoOpened(true);
		} else {
			setIsOpen(true);
			setHasAutoOpened(true);
		}
	}, [latestViewed, hasAutoOpened]);

	return (
		<UpdateNotesSheetContext.Provider
			value={{
				isOpen,
				open: () => setIsOpen(true),
				close: () => setIsOpen(false),
				setIsOpen,
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
