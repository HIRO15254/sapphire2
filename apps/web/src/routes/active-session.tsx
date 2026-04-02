import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useRef, useState } from "react";

// Cash game form context
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
			"useStackFormContext must be used within ActiveSessionLayout"
		);
	}
	return ctx;
}

// Tournament form context
interface TournamentFormState {
	chipPurchaseCounts: Array<{
		name: string;
		count: number;
		chipsPerUnit: number;
	}>;
	chipPurchases: Array<{
		id: number;
		name: string;
		cost: number;
		chips: number;
	}>;
	remainingPlayers: string;
	stackAmount: string;
	totalEntries: string;
}

interface TournamentFormContextValue {
	addChipPurchase: (purchase: {
		name: string;
		cost: number;
		chips: number;
	}) => void;
	removeChipPurchase: (id: number) => void;
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
			"useTournamentFormContext must be used within ActiveSessionLayout"
		);
	}
	return ctx;
}

export const Route = createFileRoute("/active-session")({
	component: ActiveSessionLayout,
});

function ActiveSessionLayout() {
	// Cash game state
	const [stackAmount, setStackAmount] = useState("");
	const [allIns, setAllIns] = useState<AllIn[]>([]);

	// Tournament state
	const [tStackAmount, setTStackAmount] = useState("");
	const [remainingPlayers, setRemainingPlayers] = useState("");
	const [totalEntries, setTotalEntries] = useState("");
	const [chipPurchases, setChipPurchases] = useState<
		Array<{ id: number; name: string; cost: number; chips: number }>
	>([]);
	const [chipPurchaseCounts, setChipPurchaseCounts] = useState<
		Array<{ name: string; count: number; chipsPerUnit: number }>
	>([]);
	const nextChipPurchaseId = useRef(1);

	const addChipPurchase = (purchase: {
		name: string;
		cost: number;
		chips: number;
	}) => {
		const id = nextChipPurchaseId.current;
		nextChipPurchaseId.current += 1;
		setChipPurchases((prev) => [...prev, { ...purchase, id }]);
	};

	const removeChipPurchase = (id: number) => {
		setChipPurchases((prev) => prev.filter((p) => p.id !== id));
	};

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
						chipPurchases,
						chipPurchaseCounts,
					},
					setStackAmount: setTStackAmount,
					setRemainingPlayers,
					setTotalEntries,
					setChipPurchaseCounts,
					addChipPurchase,
					removeChipPurchase,
				}}
			>
				<Outlet />
			</TournamentFormContext.Provider>
		</StackFormContext.Provider>
	);
}
