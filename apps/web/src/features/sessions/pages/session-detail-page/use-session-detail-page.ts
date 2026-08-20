import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import { useSessionDetail } from "@/features/sessions/hooks/use-session-detail";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";
import { formatDateForInput } from "@/features/sessions/utils/session-form-helpers";
import { useLiveLinkedSessionEdit } from "./use-live-linked-session-edit";

export function useSessionDetailPage(sessionId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [editRoomId, setEditRoomId] = useState<string | undefined>();
	const navigate = useNavigate();

	const {
		session,
		availableTags,
		isLoading,
		isInitialLoadError,
		onRetry,
		isUpdatePending,
		update,
		deleteSession,
		reopen,
		createTag,
	} = useSessionDetail(sessionId);

	const { rooms, currencies } = useEntityLists();
	const editGames = useRoomGames(editRoomId, { includeAll: true });

	const isLiveLinked =
		session !== null &&
		(session.liveCashGameSessionId !== null ||
			session.liveTournamentSessionId !== null);
	const canReopen = session?.liveCashGameSessionId != null;

	const {
		disabledResultFields,
		endDateHint,
		isEventUpdatePending,
		requiredResultFields,
		startDateHint,
		submitLiveEventEdits,
	} = useLiveLinkedSessionEdit({
		displayedDate: session ? formatDateForInput(session.sessionDate) : "",
		isEditOpen,
		isLiveLinked,
		sessionId,
		sessionType: session?.type === "tournament" ? "tournament" : "cash_game",
	});

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setEditRoomId(session?.roomId ?? undefined);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDelete(true);
	};

	const handleEdit = async (values: SessionFormValues) => {
		if (!session) {
			return;
		}
		const eventsSynced = await submitLiveEventEdits(values);
		if (!eventsSynced) {
			return;
		}
		try {
			await update({ id: session.id, isLiveLinked, ...values });
		} catch {
			return;
		}
		setIsEditOpen(false);
	};

	const handleConfirmDelete = () => {
		if (!session) {
			return;
		}
		deleteSession(session.id);
		setConfirmingDelete(false);
		navigate({ to: "/sessions" });
	};

	const handleReopen = () => {
		setIsActionsOpen(false);
		if (session?.liveCashGameSessionId) {
			reopen(session.liveCashGameSessionId);
		}
	};

	return {
		session,
		availableTags,
		isLoading,
		isInitialLoadError,
		onRetry,
		isUpdatePending: isUpdatePending || isEventUpdatePending,
		isLiveLinked,
		disabledResultFields,
		endDateHint,
		requiredResultFields,
		startDateHint,
		canReopen,
		rooms,
		currencies,
		editGames,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		setEditRoomId,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
		handleReopen,
		createTag,
	};
}
