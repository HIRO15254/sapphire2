import { createContext, useContext, useState } from "react";

interface EventMenuContextValue {
	close: () => void;
	isOpen: boolean;
	open: () => void;
	setIsOpen: (open: boolean) => void;
}

const EventMenuContext = createContext<EventMenuContextValue | null>(null);

/**
 * Open state for the active-session event menu (the "+" action sheet that
 * consolidates stack / player / seating / other event recording). Lives in a
 * context so the bottom-nav center button can open the menu rendered by the
 * active-session page.
 */
export function EventMenuProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<EventMenuContext.Provider
			value={{
				isOpen,
				open: () => setIsOpen(true),
				close: () => setIsOpen(false),
				setIsOpen,
			}}
		>
			{children}
		</EventMenuContext.Provider>
	);
}

export function useEventMenu() {
	const ctx = useContext(EventMenuContext);
	if (!ctx) {
		throw new Error("useEventMenu must be used within EventMenuProvider");
	}
	return ctx;
}
