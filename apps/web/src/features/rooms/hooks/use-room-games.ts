import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useRoomGames(
	roomId: string | undefined,
	options?: { includeAll?: boolean }
) {
	const includeAll = options?.includeAll ?? false;

	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({ roomId: roomId ?? "" }),
		enabled: !!roomId,
	});
	const archivedRingGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({
			roomId: roomId ?? "",
			includeArchived: true,
		}),
		enabled: !!roomId && includeAll,
	});
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByRoom.queryOptions({ roomId: roomId ?? "" }),
		enabled: !!roomId,
	});
	const archivedTournamentsQuery = useQuery({
		...trpc.tournament.listByRoom.queryOptions({
			roomId: roomId ?? "",
			includeArchived: true,
		}),
		enabled: !!roomId && includeAll,
	});

	const allRingGames = [
		...(ringGamesQuery.data ?? []),
		...(includeAll ? (archivedRingGamesQuery.data ?? []) : []),
	];
	const allTournaments = [
		...(tournamentsQuery.data ?? []),
		...(includeAll ? (archivedTournamentsQuery.data ?? []) : []),
	];

	return {
		ringGames: allRingGames.map((g) => ({
			id: g.id,
			name: g.name,
			variant: g.variant,
			blind1: g.blind1,
			blind2: g.blind2,
			blind3: g.blind3,
			ante: g.ante,
			anteType: g.anteType,
			minBuyIn: g.minBuyIn,
			maxBuyIn: g.maxBuyIn,
			tableSize: g.tableSize,
			currencyId: g.currencyId,
			houseRules: g.houseRules,
		})),
		tournaments: allTournaments.map((t) => ({
			id: t.id,
			name: t.name,
			variant: t.variant,
			buyIn: t.buyIn,
			entryFee: t.entryFee,
			startingStack: t.startingStack,
			bountyAmount: t.bountyAmount,
			tableSize: t.tableSize,
			currencyId: t.currencyId,
			houseRules: t.houseRules,
		})),
	};
}

export function useEntityLists({
	existingRoomId,
}: {
	existingRoomId?: string | null;
} = {}) {
	const roomsQuery = useQuery(trpc.room.list.queryOptions());
	const archivedRoomsQuery = useQuery({
		...trpc.room.list.queryOptions({ includeArchived: true }),
		enabled: !!existingRoomId,
	});
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	return {
		rooms: [
			...(roomsQuery.data ?? []),
			...(archivedRoomsQuery.data ?? []).filter((s) => s.id === existingRoomId),
		].map((s) => ({ id: s.id, name: s.name })),
		currencies: (currenciesQuery.data ?? []).map((c) => ({
			id: c.id,
			name: c.name,
		})),
	};
}

export function useRoomFilterOptions() {
	const roomsQuery = useQuery(trpc.room.list.queryOptions());
	const archivedRoomsQuery = useQuery(
		trpc.room.list.queryOptions({ includeArchived: true })
	);
	return [...(roomsQuery.data ?? []), ...(archivedRoomsQuery.data ?? [])].map(
		(s) => ({ id: s.id, name: s.name })
	);
}
