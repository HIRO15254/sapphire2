import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { LATEST_VERSION } from "@/features/update-notes/constants";
import { shouldAutoOpenUpdateNotes } from "@/features/update-notes/utils/should-auto-open-update-notes";
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

	const { data: viewedList } = useQuery(
		trpc.updateNoteView.list.queryOptions()
	);

	useEffect(() => {
		// Wait until the viewed list has loaded before deciding once.
		if (hasAutoOpened || viewedList === undefined) {
			return;
		}

		if (
			shouldAutoOpenUpdateNotes({
				latestVersion: LATEST_VERSION,
				viewedVersions: viewedList.map((view) => view.version),
			})
		) {
			setIsOpen(true);
		}
		setHasAutoOpened(true);
	}, [viewedList, hasAutoOpened]);

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
