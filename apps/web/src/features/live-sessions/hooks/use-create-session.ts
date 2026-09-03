import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { findNearestRoom } from "@/features/live-sessions/utils/geo";
import { useGeolocation } from "@/shared/hooks/use-geolocation";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

function useRoomRingGames(roomId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({ roomId: roomId ?? "" }),
		enabled: !!roomId,
	});
	return (ringGamesQuery.data ?? []).map((g) => ({
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
	}));
}

interface CreateCashValues {
	currencyId?: string;
	initialBuyIn: number;
	memo?: string;
	ringGameId?: string;
	roomId?: string;
}

interface CreateTournamentValues {
	buyIn: number;
	currencyId?: string;
	entryFee?: number;
	memo?: string;
	roomId?: string;
	startingStack: number;
	timerStartedAt?: number;
	tournamentId?: string;
}

function useRoomTournaments(roomId: string | undefined) {
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByRoom.queryOptions({
			roomId: roomId ?? "",
			includeArchived: false,
		}),
		enabled: !!roomId,
	});
	return (tournamentsQuery.data ?? []).map((t) => ({
		id: t.id,
		name: t.name,
		variant: t.variant,
		buyIn: t.buyIn,
		entryFee: t.entryFee,
		startingStack: t.startingStack,
		bountyAmount: t.bountyAmount,
		tableSize: t.tableSize,
		currencyId: t.currencyId,
	}));
}

export function useCreateSession({
	onClose,
	open = false,
}: {
	onClose: () => void;
	open?: boolean;
}) {
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const { coords } = useGeolocation({ enabled: open });

	const roomsQuery = useQuery(trpc.room.list.queryOptions());
	const rooms = (roomsQuery.data ?? []).map((s) => ({
		id: s.id,
		name: s.name,
	}));

	const roomListKey = trpc.room.list.queryOptions().queryKey;

	const [pendingStart, setPendingStart] = useState<(() => void) | null>(null);
	const [promptRoom, setPromptRoom] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const updateRoomLocationMutation = useMutation({
		mutationFn: (vars: { id: string; latitude: number; longitude: number }) =>
			trpcClient.room.update.mutate(vars),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: roomListKey }]);
			toast.success("Room location saved");
		},
		onError: () => {
			toast.error("Couldn't save room location");
		},
	});

	const startOrPrompt = (roomId: string | undefined, run: () => void) => {
		const targetRoom = (roomsQuery.data ?? []).find((r) => r.id === roomId);
		if (
			coords &&
			targetRoom &&
			targetRoom.latitude == null &&
			targetRoom.longitude == null
		) {
			setPendingStart(() => run);
			setPromptRoom({ id: targetRoom.id, name: targetRoom.name });
			return;
		}
		run();
	};

	const closePrompt = () => {
		setPromptRoom(null);
		setPendingStart(null);
	};

	const handleLocationSkip = () => {
		const run = pendingStart;
		closePrompt();
		run?.();
	};

	const handleLocationSave = () => {
		const run = pendingStart;
		const target = promptRoom;
		closePrompt();
		if (target && coords) {
			updateRoomLocationMutation.mutate({
				id: target.id,
				latitude: coords.latitude,
				longitude: coords.longitude,
			});
		}
		run?.();
	};

	const nearestRoomId = useMemo(() => {
		if (!coords) {
			return;
		}
		return findNearestRoom(
			coords,
			(roomsQuery.data ?? []).map((s) => ({
				id: s.id,
				latitude: s.latitude ?? null,
				longitude: s.longitude ?? null,
			}))
		)?.id;
	}, [coords, roomsQuery.data]);

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = (currenciesQuery.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
	}));

	const ringGames = useRoomRingGames(selectedRoomId);
	const tournaments = useRoomTournaments(selectedRoomId);

	const cashListKey = trpc.liveCashGameSession.list.queryOptions({}).queryKey;
	const tournamentListKey = trpc.liveTournamentSession.list.queryOptions(
		{}
	).queryKey;

	const sessionListKey = trpc.session.list.queryOptions({}).queryKey;

	const createCashMutation = useMutation({
		mutationFn: (values: CreateCashValues) =>
			trpcClient.liveCashGameSession.create.mutate(values),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: cashListKey },
				{ queryKey: sessionListKey },
			]);
			onClose();
			await navigate({ to: "/active-session" });
		},
	});

	const createTournamentMutation = useMutation({
		mutationFn: async (values: CreateTournamentValues) => {
			const { startingStack, ...createValues } = values;
			const result =
				await trpcClient.liveTournamentSession.create.mutate(createValues);
			await trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: result.id,
				eventType: "update_stack",
				payload: {
					stackAmount: startingStack,
				},
			});
			return result;
		},
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: tournamentListKey },
				{ queryKey: sessionListKey },
			]);
			onClose();
			await navigate({ to: "/active-session" });
		},
	});

	const isLoading =
		createCashMutation.isPending || createTournamentMutation.isPending;

	return {
		rooms,
		currencies,
		ringGames,
		tournaments,
		selectedRoomId,
		setSelectedRoomId,
		nearestRoomId,
		createCash: (values: CreateCashValues) =>
			startOrPrompt(values.roomId, () => createCashMutation.mutate(values)),
		createTournament: (values: CreateTournamentValues) =>
			startOrPrompt(values.roomId, () =>
				createTournamentMutation.mutate(values)
			),
		locationPrompt: {
			open: promptRoom !== null,
			roomName: promptRoom?.name ?? "",
			onSave: handleLocationSave,
			onSkip: handleLocationSkip,
			onOpenChange: (nextOpen: boolean) => {
				if (!nextOpen) {
					handleLocationSkip();
				}
			},
		},
		isLoading,
	};
}
