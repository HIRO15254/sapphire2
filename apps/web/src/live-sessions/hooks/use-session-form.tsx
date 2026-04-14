import { createContext, useContext, useState } from "react";

// --- Cash game form context ---

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
			"useStackFormContext must be used within SessionFormProvider"
		);
	}
	return ctx;
}

// --- Tournament form context ---

interface TournamentFormState {
	chipPurchaseCounts: Array<{
		name: string;
		count: number;
		chipsPerUnit: number;
	}>;
	remainingPlayers: string;
	stackAmount: string;
	totalEntries: string;
}

interface TournamentFormContextValue {
	setChipPurchaseCounts: React.Dispatch<
		React.SetStateAction<
			Array<{ name: string; count: number; chipsPerUnit: number }>
		>
	>;
	setRemainingPlayers: (value: string) => void;
	setStackAmount: (value: string) => void;
	setTotalEntries: (value: string) => void;
	state: TournamentFormState;
}

const TournamentFormContext = createContext<TournamentFormContextValue | null>(
	null
);

export function useTournamentFormContext() {
	const ctx = useContext(TournamentFormContext);
	if (!ctx) {
		throw new Error(
			"useTournamentFormContext must be used within SessionFormProvider"
		);
	}
	return ctx;
}

// --- Provider ---

export function SessionFormProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	// Cash game state
	const [stackAmount, setStackAmount] = useState("");
	const [allIns, setAllIns] = useState<AllIn[]>([]);

	// Tournament state
	const [tStackAmount, setTStackAmount] = useState("");
	const [remainingPlayers, setRemainingPlayers] = useState("");
	const [totalEntries, setTotalEntries] = useState("");
	const [chipPurchaseCounts, setChipPurchaseCounts] = useState<
		Array<{ name: string; count: number; chipsPerUnit: number }>
	>([]);

	return (
		<StackFormContext.Provider
			value={{
				state: { stackAmount, allIns },
				setStackAmount,
				setAllIns,
			}}
		>
			<TournamentFormContext.Provider
				value={{
					state: {
						stackAmount: tStackAmount,
						remainingPlayers,
						totalEntries,
						chipPurchaseCounts,
					},
					setStackAmount: setTStackAmount,
					setRemainingPlayers,
					setTotalEntries,
					setChipPurchaseCounts,
				}}
			>
				{children}
			</TournamentFormContext.Provider>
		</StackFormContext.Provider>
	);
}
