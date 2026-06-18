import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import { useSessionDetail } from "@/features/sessions/hooks/use-session-detail";
import { useSessionFlight } from "@/features/sessions/hooks/use-session-flight";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";

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
		isUpdatePending,
		update,
		deleteSession,
		reopen,
		createTag,
	} = useSessionDetail(sessionId);

	const { rooms, currencies } = useEntityLists();
	const editGames = useRoomGames(editRoomId, { includeAll: true });
	const flight = useSessionFlight(
		session?.type === "tournament" ? session.id : null
	);

	const isLiveLinked =
		session !== null &&
		(session.liveCashGameSessionId !== null ||
			session.liveTournamentSessionId !== null);
	const canReopen = session?.liveCashGameSessionId != null;

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setEditRoomId(session?.roomId ?? undefined);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDelete(true);
	};

	const handleEdit = (values: SessionFormValues) => {
		if (!session) {
			return;
		}
		update({ id: session.id, isLiveLinked, ...values }).then(() => {
			setIsEditOpen(false);
		});
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
		flight,
		availableTags,
		isLoading,
		isUpdatePending,
		isLiveLinked,
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
