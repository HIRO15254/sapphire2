import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { RingGameFormValues } from "@/features/stores/hooks/use-ring-games";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

type Mode = "existing" | "create";

interface RingGameListItem {
	id: string;
	name: string;
}

interface UseAssignRingGameOptions {
	onClose: () => void;
	open: boolean;
	sessionId: string;
	sessionStoreId: string | null;
}

export function useAssignRingGame({
	onClose,
	open,
	sessionId,
	sessionStoreId,
}: UseAssignRingGameOptions) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<Mode>("existing");
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		sessionStoreId ?? undefined
	);

	const storesQuery = useQuery({
		...trpc.store.list.queryOptions(),
		enabled: open,
	});
	const stores = storesQuery.data ?? [];

	const effectiveStoreId = sessionStoreId ?? selectedStoreId;

	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({
			storeId: effectiveStoreId ?? "",
			includeArchived: false,
		}),
		enabled: open && !!effectiveStoreId,
	});
	const ringGames = (ringGamesQuery.data ?? []) as RingGameListItem[];

	const invalidateSession = () =>
		invalidateTargets(queryClient, [
			{
				queryKey: trpc.liveCashGameSession.getById.queryOptions({
					id: sessionId,
				}).queryKey,
			},
			{ queryKey: trpc.liveCashGameSession.list.queryOptions({}).queryKey },
			{ queryKey: trpc.session.list.queryOptions({}).queryKey },
		]);

	const assignMutation = useMutation({
		mutationFn: (ringGameId: string) =>
			trpcClient.liveCashGameSession.update.mutate({
				id: sessionId,
				ringGameId,
			}),
		onSuccess: async () => {
			await invalidateSession();
			toast.success("Game assigned");
			onClose();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to assign game");
		},
	});

	const createAndAssignMutation = useMutation({
		mutationFn: async ({
			storeId,
			values,
		}: {
			storeId: string;
			values: RingGameFormValues;
		}) => {
			const created = await trpcClient.ringGame.create.mutate({
				storeId,
				...values,
			});
			await trpcClient.liveCashGameSession.update.mutate({
				id: sessionId,
				ringGameId: created.id,
			});
			return created;
		},
		onSuccess: async () => {
			await Promise.all([
				invalidateSession(),
				invalidateTargets(queryClient, [
					{
						queryKey: trpc.ringGame.listByStore.queryOptions({
							storeId: effectiveStoreId ?? "",
						}).queryKey,
					},
				]),
			]);
			toast.success("Game created and assigned");
			onClose();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create game");
		},
	});

	const selectForm = useForm({
		defaultValues: { ringGameId: "" },
		onSubmit: ({ value }) => {
			if (!value.ringGameId) {
				return;
			}
			assignMutation.mutate(value.ringGameId);
		},
	});

	const handleCreate = (values: RingGameFormValues) => {
		if (!effectiveStoreId) {
			toast.error("Select a store first");
			return;
		}
		createAndAssignMutation.mutate({ storeId: effectiveStoreId, values });
	};

	const isAssignPending = assignMutation.isPending;
	const isCreatePending = createAndAssignMutation.isPending;
	const isBusy = isAssignPending || isCreatePending;

	return {
		mode,
		setMode,
		stores,
		selectedStoreId,
		setSelectedStoreId,
		effectiveStoreId,
		ringGames,
		selectForm,
		handleCreate,
		isAssignPending,
		isCreatePending,
		isBusy,
	};
}
