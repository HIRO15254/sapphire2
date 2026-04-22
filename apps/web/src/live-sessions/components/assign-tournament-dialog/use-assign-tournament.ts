import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";
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
	}));
}

interface UseAssignTournamentArgs {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionStoreId: string | null;
}

export function useAssignTournament({
	onOpenChange,
	open,
	sessionId,
	sessionStoreId,
}: UseAssignTournamentArgs) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<AssignTournamentMode>("existing");
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		sessionStoreId ?? undefined
	);
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		string | undefined
	>(undefined);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const storesQuery = useQuery({
		...trpc.store.list.queryOptions(),
		enabled: open,
	});
	const stores = storesQuery.data ?? [];

	const effectiveStoreId = sessionStoreId ?? selectedStoreId;

	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({
			storeId: effectiveStoreId ?? "",
			includeArchived: false,
		}),
		enabled: open && !!effectiveStoreId,
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
			storeId,
			values,
			levels,
		}: {
			storeId: string;
			values: TournamentFormValues;
			levels: BlindLevelRow[];
		}) => {
			const created = await trpcClient.tournament.createWithLevels.mutate({
				storeId,
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
						queryKey: trpc.tournament.listByStore.queryOptions({
							storeId: effectiveStoreId ?? "",
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

	const handleStoreChange = (value: string) => {
		setSelectedStoreId(value);
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
		if (!effectiveStoreId) {
			toast.error("Select a store first");
			return;
		}
		await createAndAssignMutation.mutateAsync({
			storeId: effectiveStoreId,
			values,
			levels,
		});
	};

	return {
		mode,
		setMode,
		selectedStoreId,
		selectedTournamentId,
		setSelectedTournamentId,
		isCreateDialogOpen,
		setIsCreateDialogOpen,
		stores,
		tournaments,
		effectiveStoreId,
		isAssignPending,
		isCreatePending,
		isBusy,
		handleStoreChange,
		handleAssign,
		handleCreate,
	};
}
