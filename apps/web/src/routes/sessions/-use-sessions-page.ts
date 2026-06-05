import { useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import type { SessionFilterValues } from "@/features/sessions/components/session-filters";
import type {
	SessionFormValues,
	SessionItem,
} from "@/features/sessions/hooks/use-sessions";
import { useSessions } from "@/features/sessions/hooks/use-sessions";

type ViewingEventsState = {
	sessionId: string;
	sessionType: "cash_game" | "tournament";
} | null;

export function useSessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [editingSession, setEditingSession] = useState<SessionItem | null>(
		null
	);
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
	const [editRoomId, setEditRoomId] = useState<string | undefined>();
	const [filters, setFilters] = useState<SessionFilterValues>({});
	const [bbBiMode, setBbBiMode] = useState(false);
	const [viewingEvents, setViewingEvents] = useState<ViewingEventsState>(null);

	const {
		sessions,
		availableTags,
		isCreatePending,
		isUpdatePending,
		create,
		update,
		delete: deleteSession,
		reopen,
		createTag,
	} = useSessions(filters);

	const { rooms, currencies } = useEntityLists();
	const createGames = useRoomGames(selectedRoomId);
	const editGames = useRoomGames(editRoomId, { includeAll: true });

	const handleCreate = (values: SessionFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: SessionFormValues) => {
		if (!editingSession) {
			return;
		}
		const isLiveLinked =
			editingSession.liveCashGameSessionId !== null ||
			editingSession.liveTournamentSessionId !== null;
		update({ id: editingSession.id, isLiveLinked, ...values }).then(() => {
			setEditingSession(null);
		});
	};

	const handleDelete = (id: string) => {
		deleteSession(id);
	};

	const handleReopen = (liveCashGameSessionId: string) => {
		reopen(liveCashGameSessionId);
	};

	const handleOpenEdit = (session: SessionItem) => {
		setEditingSession(session);
		setEditRoomId(session.roomId ?? undefined);
	};

	const handleCloseEdit = () => {
		setEditingSession(null);
		setEditRoomId(undefined);
	};

	const handleCreateDialogOpenChange = (open: boolean) => {
		setIsCreateOpen(open);
		if (!open) {
			setSelectedRoomId(undefined);
		}
	};

	const handleOpenEvents = ({
		sessionId,
		sessionType,
	}: {
		sessionId: string;
		sessionType: "cash-game" | "tournament";
	}) => {
		setViewingEvents({
			sessionId,
			sessionType: sessionType === "tournament" ? "tournament" : "cash_game",
		});
	};

	const handleCloseEvents = () => {
		setViewingEvents(null);
	};

	const isEditLiveLinked =
		editingSession !== null &&
		(editingSession.liveCashGameSessionId !== null ||
			editingSession.liveTournamentSessionId !== null);

	return {
		sessions,
		availableTags,
		isCreatePending,
		isUpdatePending,
		isCreateOpen,
		isTagManagerOpen,
		editingSession,
		filters,
		bbBiMode,
		rooms,
		currencies,
		createGames,
		editGames,
		isEditLiveLinked,
		viewingEvents,
		setIsTagManagerOpen,
		setFilters,
		setBbBiMode,
		setSelectedRoomId,
		setEditRoomId,
		handleCreate,
		handleUpdate,
		handleDelete,
		handleReopen,
		handleOpenEdit,
		handleCloseEdit,
		handleCreateDialogOpenChange,
		handleOpenEvents,
		handleCloseEvents,
		createTag,
	};
}
