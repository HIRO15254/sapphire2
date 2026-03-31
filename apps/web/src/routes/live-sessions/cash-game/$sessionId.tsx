import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";

interface AllIn {
	equity: number;
	id: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface StackFormState {
	allIns: AllIn[];
	stackAmount: string;
}

interface StackFormContextValue {
	setAllIns: React.Dispatch<React.SetStateAction<AllIn[]>>;
	setStackAmount: (value: string) => void;
	state: StackFormState;
}

const StackFormContext = createContext<StackFormContextValue | null>(null);

export function useStackFormContext() {
	const ctx = useContext(StackFormContext);
	if (!ctx) {
		throw new Error(
			"useStackFormContext must be used within CashGameSessionLayout"
		);
	}
	return ctx;
}

export const Route = createFileRoute("/live-sessions/cash-game/$sessionId")({
	component: CashGameSessionLayout,
});

function CashGameSessionLayout() {
	const [stackAmount, setStackAmount] = useState("");
	const [allIns, setAllIns] = useState<AllIn[]>([]);

	return (
		<StackFormContext.Provider
			value={{
				state: { stackAmount, allIns },
				setStackAmount,
				setAllIns,
			}}
		>
			<Outlet />
		</StackFormContext.Provider>
	);
}
