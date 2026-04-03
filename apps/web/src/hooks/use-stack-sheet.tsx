import { createContext, useContext, useState } from "react";

interface StackSheetContextValue {
	close: () => void;
	isOpen: boolean;
	open: () => void;
	setIsOpen: (open: boolean) => void;
}

const StackSheetContext = createContext<StackSheetContextValue | null>(null);

export function StackSheetProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<StackSheetContext.Provider
			value={{
				isOpen,
				open: () => setIsOpen(true),
				close: () => setIsOpen(false),
				setIsOpen,
			}}
		>
			{children}
		</StackSheetContext.Provider>
	);
}

export function useStackSheet() {
	const ctx = useContext(StackSheetContext);
	if (!ctx) {
		throw new Error("useStackSheet must be used within StackSheetProvider");
	}
	return ctx;
}
