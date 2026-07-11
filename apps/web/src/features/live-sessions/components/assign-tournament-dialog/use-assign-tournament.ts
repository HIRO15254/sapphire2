import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export type AssignTournamentMode = "existing" | "create";

export interface TournamentListItem {
	id: string;
	name: string;
}

function levelsToPayload(levels: BlindLevelRow[]) {
	return levels.map((l) => ({
		isBreak: l.isBreak,
		blind1: l.blind1,
		blind2: l.blind2,
		blind3: l.blind3,
		ante: l.ante,
		minutes: l.minutes,
		games: l.games ?? null,
	}));
}

interface UseAssignTournamentArgs {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionRoomId: string | null;
}

export function useAssignTournament({
	onOpenChange,
	open,
	sessionId,
	sessionRoomId,
}: UseAssignTournamentArgs) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<AssignTournamentMode>("existing");
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(
		sessionRoomId ?? undefined
	);
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		string | undefined
	>(undefined);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const roomsQuery = useQuery({
		...trpc.room.list.queryOptions(),
		enabled: open,
	});
	const rooms = roomsQuery.data ?? [];

	const effectiveRoomId = sessionRoomId ?? selectedRoomId;

	const tournamentsQuery = useQuery({
		...trpc.tournament.listByRoom.queryOptions({
			roomId: effectiveRoomId ?? "",
			includeArchived: false,
		}),
		enabled: open && !!effectiveRoomId,
	});
	const tournaments = (tournamentsQuery.data ?? []) as TournamentListItem[];

	const invalidateSession = async () => {
		await invalidateTargets(queryClient, [
			{
				queryKey: trpc.liveTournamentSession.getById.queryOptions({
					id: sessionId,
				}).queryKey,
			},
			{
				queryKey: trpc.liveTournamentSession.list.queryOptions({}).queryKey,
			},
			{ queryKey: trpc.session.list.queryOptions({}).queryKey },
		]);
	};

	const assignMutation = useMutation({
		mutationFn: (tournamentId: string) =>
			trpcClient.liveTournamentSession.update.mutate({
				id: sessionId,
				tournamentId,
			}),
		onSuccess: async () => {
			await invalidateSession();
			toast.success("Tournament assigned");
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to assign tournament");
		},
	});

	const createAndAssignMutation = useMutation({
		mutationFn: async ({
			roomId,
			values,
			levels,
		}: {
			roomId: string;
			values: TournamentFormValues;
			levels: BlindLevelRow[];
		}) => {
			const created = await trpcClient.tournament.createWithLevels.mutate({
				roomId,
				name: values.name,
				variant: values.variant,
				buyIn: values.buyIn,
				entryFee: values.entryFee,
				startingStack: values.startingStack,
				bountyAmount: values.bountyAmount,
				tableSize: values.tableSize,
				currencyId: values.currencyId,
				memo: values.memo,
				tags: values.tags,
				chipPurchases: values.chipPurchases,
				blindLevels: levelsToPayload(levels),
			});
			await trpcClient.liveTournamentSession.update.mutate({
				id: sessionId,
				tournamentId: created.id,
			});
			return created;
		},
		onSuccess: async () => {
			await Promise.all([
				invalidateSession(),
				invalidateTargets(queryClient, [
					{
						queryKey: trpc.tournament.listByRoom.queryOptions({
							roomId: effectiveRoomId ?? "",
							includeArchived: false,
						}).queryKey,
					},
				]),
			]);
			toast.success("Tournament created and assigned");
			setIsCreateDialogOpen(false);
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create tournament");
		},
	});

	const isAssignPending = assignMutation.isPending;
	const isCreatePending = createAndAssignMutation.isPending;
	const isBusy = isAssignPending || isCreatePending;

	const handleRoomChange = (value: string) => {
		setSelectedRoomId(value);
		setSelectedTournamentId(undefined);
	};

	const handleAssign = () => {
		if (!selectedTournamentId) {
			return;
		}
		assignMutation.mutate(selectedTournamentId);
	};

	const handleCreate = async (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => {
		if (!effectiveRoomId) {
			toast.error("Select a room first");
			return;
		}
		await createAndAssignMutation.mutateAsync({
			roomId: effectiveRoomId,
			values,
			levels,
		});
	};

	return {
		mode,
		setMode,
		selectedRoomId,
		selectedTournamentId,
		setSelectedTournamentId,
		isCreateDialogOpen,
		setIsCreateDialogOpen,
		rooms,
		tournaments,
		effectiveRoomId,
		isAssignPending,
		isCreatePending,
		isBusy,
		handleRoomChange,
		handleAssign,
		handleCreate,
	};
}
