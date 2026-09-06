import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/session-event-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { updateHeroSeatViaClient } from "@/features/live-sessions/utils/seat-screenshot";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";
import { useTablePlayers } from "@/features/players/hooks/use-table-players";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryEntity,
} from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

const DEFAULT_SEAT_COUNT = 9;
const MIN_SEAT_COUNT = 2;
const MAX_SEAT_COUNT = MAX_SEAT_POSITION + 1;

export type SessionParam =
	| { liveCashGameSessionId: string; liveTournamentSessionId?: never }
	| { liveCashGameSessionId?: never; liveTournamentSessionId: string };

export interface SeatPlayer {
	id: string;
	isLoading: boolean;
	isTemporary: boolean;
	memo: string | null;
	name: string;
	playerId: string;
	seatPosition: number | null;
	tags: PlayerTagWithColor[];
}

export interface SeatEntry {
	isHero: boolean;
	player: SeatPlayer | null;
	seatPosition: number;
}

interface UseActiveSessionSceneStateOptions {
	heroSeatPosition: number | null;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
	tableSize: number | null;
}

export interface ActiveSessionSceneState {
	excludePlayerIds: string[];
	heroAvailable: boolean;
	heroSeatPosition: number | null;
	occupiedSeatPositions: Set<number>;
	onRemovePlayer: (playerId: string) => void;
	onSeatExisting: (
		seatPosition: number,
		playerId: string,
		playerName: string
	) => void;
	onSeatHero: (seatPosition: number) => void;
	onSeatNew: (
		seatPosition: number,
		values: { memo?: string | null; name: string; tagIds?: string[] }
	) => void;
	onSeatTemporary: (seatPosition: number) => void;
	onUnseatHero: () => void;
	seats: SeatEntry[];
	sessionParam: SessionParam;
	tableSize: number;
	unseatedPlayers: SeatPlayer[];
}

interface SessionHeroSeat {
	heroSeatPosition?: number | null;
	[key: string]: unknown;
}

export function resolveSeatCount(tableSize: number | null): number {
	if (
		typeof tableSize === "number" &&
		tableSize >= MIN_SEAT_COUNT &&
		tableSize <= MAX_SEAT_COUNT
	) {
		return tableSize;
	}
	return DEFAULT_SEAT_COUNT;
}

export function useActiveSessionSceneState({
	heroSeatPosition,
	sessionId,
	sessionType,
	tableSize,
}: UseActiveSessionSceneStateOptions): ActiveSessionSceneState {
	const sessionParam: SessionParam =
		sessionType === "cash_game"
			? { liveCashGameSessionId: sessionId }
			: { liveTournamentSessionId: sessionId };
	const tablePlayers = useTablePlayers(sessionParam);
	const queryClient = useQueryClient();

	const sessionKey =
		sessionType === "cash_game"
			? trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
					.queryKey
			: trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
					.queryKey;

	const heroSeatMutation = useMutation({
		mutationFn: (seatPosition: number | null) =>
			updateHeroSeatViaClient(sessionParam, seatPosition),
		onMutate: async (seatPosition: number | null) => {
			await cancelTargets(queryClient, [{ queryKey: sessionKey }]);
			const previous = snapshotQuery(queryClient, sessionKey);
			updateQueryEntity<SessionHeroSeat>(queryClient, sessionKey, {
				heroSeatPosition: seatPosition,
			});
			return { previous };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: sessionKey }]);
		},
	});

	const playerListQuery = useQuery(trpc.player.list.queryOptions());
	const tagsByPlayerId = useMemo(() => {
		const map = new Map<string, PlayerTagWithColor[]>();
		for (const p of playerListQuery.data ?? []) {
			map.set(p.id, p.tags);
		}
		return map;
	}, [playerListQuery.data]);

	const activePlayers: SeatPlayer[] = tablePlayers.players
		.filter((p) => p.isActive)
		.map((p) => ({
			id: p.id,
			isLoading: p.isLoading,
			isTemporary: p.player.isTemporary,
			memo: p.player.memo,
			name: p.player.name,
			playerId: p.player.id,
			seatPosition: p.seatPosition,
			tags: tagsByPlayerId.get(p.player.id) ?? [],
		}));

	const seatCount = resolveSeatCount(tableSize);

	const seats: SeatEntry[] = [];
	for (let i = 0; i < seatCount; i++) {
		const isHero = heroSeatPosition === i;
		seats.push({
			isHero,
			seatPosition: i,
			player: isHero
				? null
				: (activePlayers.find((p) => p.seatPosition === i) ?? null),
		});
	}

	const unseatedPlayers = activePlayers.filter(
		(p) =>
			p.seatPosition === null ||
			p.seatPosition >= seatCount ||
			p.seatPosition === heroSeatPosition
	);

	const occupiedSeatPositions = new Set<number>();
	for (const p of activePlayers) {
		if (typeof p.seatPosition === "number") {
			occupiedSeatPositions.add(p.seatPosition);
		}
	}

	return {
		excludePlayerIds: tablePlayers.excludePlayerIds,
		heroAvailable: heroSeatPosition === null,
		heroSeatPosition,
		occupiedSeatPositions,
		onRemovePlayer: (playerId) => {
			tablePlayers.handleRemovePlayer(playerId);
		},
		onSeatExisting: (seatPosition, playerId, playerName) => {
			tablePlayers.handleAddExisting(playerId, playerName, seatPosition);
		},
		onSeatHero: (seatPosition) => {
			heroSeatMutation.mutate(seatPosition);
		},
		onSeatNew: (seatPosition, { name, memo, tagIds }) => {
			tablePlayers.handleAddNew(name, seatPosition, memo ?? undefined, tagIds);
		},
		onSeatTemporary: (seatPosition) => {
			tablePlayers.handleAddTemporary(seatPosition);
		},
		onUnseatHero: () => {
			heroSeatMutation.mutate(null);
		},
		seats,
		sessionParam,
		tableSize: seatCount,
		unseatedPlayers,
	};
}
