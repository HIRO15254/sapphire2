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
	sessionId,
}: {
	children: React.ReactNode;
	/**
	 * Id of the currently active live session. The provider is mounted once at
	 * app shell scope, so without this key its state would survive across
	 * sessions and prefill the next session's Record Stack sheet with the
	 * previous one's values — and carry a finished tournament's
	 * `chipPurchaseCounts` into the next `update_stack` payload, corrupting the
	 * average-stack calculation (SA2-171). Passing the active session id lets us
	 * clear every field the moment the session changes.
	 */
	sessionId?: string | null;
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

	// Reset every cash + tournament field whenever the active session changes,
	// including when it clears to null (session finished / discarded). Adjusting
	// state during render is React's recommended pattern for "reset on prop
	// change" — it avoids the extra effect pass (and the stale-value flash) a
	// `useEffect` would introduce, and it keeps children mounted (a `key` on the
	// provider would remount the whole app shell). See SA2-171.
	const [trackedSessionId, setTrackedSessionId] = useState(sessionId);
	if (sessionId !== trackedSessionId) {
		setTrackedSessionId(sessionId);
		setStackAmount("");
		setAllIns([]);
		setTStackAmount("");
		setRemainingPlayers("");
		setTotalEntries("");
		setChipPurchaseCounts([]);
	}

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
