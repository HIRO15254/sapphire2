import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
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
	sessionRoomId: string | null;
}

export function useAssignRingGame({
	onClose,
	open,
	sessionId,
	sessionRoomId,
}: UseAssignRingGameOptions) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<Mode>("existing");
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(
		sessionRoomId ?? undefined
	);

	const roomsQuery = useQuery({
		...trpc.room.list.queryOptions(),
		enabled: open,
	});
	const rooms = roomsQuery.data ?? [];

	const effectiveRoomId = sessionRoomId ?? selectedRoomId;

	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({
			roomId: effectiveRoomId ?? "",
			includeArchived: false,
		}),
		enabled: open && !!effectiveRoomId,
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
		mutationFn: ({
			roomId,
			values,
		}: {
			roomId: string;
			values: RingGameFormValues;
		}) =>
			trpcClient.liveCashGameSession.createAndAssignRingGame.mutate({
				sessionId,
				roomId,
				...values,
			}),
		onSuccess: async () => {
			await Promise.all([
				invalidateSession(),
				invalidateTargets(queryClient, [
					{
						queryKey: trpc.ringGame.listByRoom.queryOptions({
							roomId: effectiveRoomId ?? "",
						}).queryKey,
					},
				]),
			]);
			toast.success("Game created and assigned");
			onClose();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create and assign game");
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
		if (!effectiveRoomId) {
			toast.error("Select a room first");
			return;
		}
		createAndAssignMutation.mutate({ roomId: effectiveRoomId, values });
	};

	const isAssignPending = assignMutation.isPending;
	const isCreatePending = createAndAssignMutation.isPending;
	const isBusy = isAssignPending || isCreatePending;

	return {
		mode,
		setMode,
		rooms,
		selectedRoomId,
		setSelectedRoomId,
		effectiveRoomId,
		ringGames,
		selectForm,
		handleCreate,
		isAssignPending,
		isCreatePending,
		isBusy,
	};
}
