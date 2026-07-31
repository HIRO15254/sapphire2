import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import { useSessionDetail } from "@/features/sessions/hooks/use-session-detail";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";
import { useLiveLinkedSessionEdit } from "./use-live-linked-session-edit";

/**
 * Page hook for the session detail page. Owns the actions sheet / edit sheet /
 * delete dialog state and the edit-form room→games lookup, delegating data to
 * {@link useSessionDetail}. Edit, delete and reopen all live here (they moved
 * off the list page in the v2 rework).
 */
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

	const { disabledResultFields, isEventUpdatePending, submitLiveEventEdits } =
		useLiveLinkedSessionEdit({
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

	/**
	 * Saves the sheet. For a live session the fields backed by a single event
	 * value go back to those events first (`session.update` refuses them), and a
	 * rejected edit keeps the sheet open so the user can correct it — the failed
	 * step is the only one not applied, because the server recalculates the
	 * session after every event write.
	 */
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
			// The shared mutation cache toasts the server message; keep the sheet
			// open so the entered values are not lost.
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
