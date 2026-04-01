import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";

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
	addon: { cost: number; chips: number } | null;
	averageStack: string;
	rebuy: { cost: number; chips: number } | null;
	remainingPlayers: string;
	stackAmount: string;
}

interface TournamentFormContextValue {
	setAddon: (addon: { cost: number; chips: number } | null) => void;
	setAverageStack: (value: string) => void;
	setRebuy: (rebuy: { cost: number; chips: number } | null) => void;
	setRemainingPlayers: (value: string) => void;
	setStackAmount: (value: string) => void;
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
	const [averageStack, setAverageStack] = useState("");
	const [rebuy, setRebuy] = useState<{ cost: number; chips: number } | null>(
		null
	);
	const [addon, setAddon] = useState<{ cost: number; chips: number } | null>(
		null
	);

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
						averageStack,
						rebuy,
						addon,
					},
					setStackAmount: setTStackAmount,
					setRemainingPlayers,
					setAverageStack,
					setRebuy,
					setAddon,
				}}
			>
				<Outlet />
			</TournamentFormContext.Provider>
		</StackFormContext.Provider>
	);
}
