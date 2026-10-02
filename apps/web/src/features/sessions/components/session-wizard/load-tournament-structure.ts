import type {
	SessionBlindLevelInput,
	SessionChipPurchaseInput,
} from "@/features/sessions/utils/session-form-helpers";
import { trpcClient } from "@/utils/trpc";

export interface TournamentStructure {
	blindLevels: SessionBlindLevelInput[];
	chipPurchases: Omit<SessionChipPurchaseInput, "count">[];
}

export async function loadTournamentStructure(
	tournamentId: string
): Promise<TournamentStructure> {
	const [levels, purchases] = await Promise.all([
		trpcClient.blindLevel.listByTournament
			.query({ tournamentId })
			.catch(() => []),
		trpcClient.tournamentChipPurchase.listByTournament
			.query({ tournamentId })
			.catch(() => []),
	]);
	return {
		blindLevels: levels.map((l) => ({
			isBreak: l.isBreak,
			blind1: l.blind1,
			blind2: l.blind2,
			blind3: l.blind3,
			ante: l.ante,
			minutes: l.minutes,
			games: l.games ?? null,
		})),
		chipPurchases: purchases.map((p) => ({
			name: p.name,
			cost: p.cost,
			chips: p.chips,
		})),
	};
}
