import { useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import type { SessionFilterValues } from "@/features/sessions/components/session-filters";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";
import { useSessions } from "@/features/sessions/hooks/use-sessions";

/**
 * Page hook for the v2 sessions list. Owns the filter state, the create sheet
 * + tag manager open state, and the room→games lookup that feeds the create
 * wizard. Editing / deleting / reopening a session now lives on the detail
 * page, so this hook is intentionally narrower than the legacy page hook.
 */
export function useSessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
	const [filters, setFilters] = useState<SessionFilterValues>({});
	const [bbBiMode, setBbBiMode] = useState(false);

	const {
		sessions,
		availableTags,
		isLoading,
		isCreatePending,
		create,
		createTag,
	} = useSessions(filters);

	const { rooms, currencies } = useEntityLists();
	const createGames = useRoomGames(selectedRoomId);

	const handleCreate = (values: SessionFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
			setSelectedRoomId(undefined);
		});
	};

	const handleCreateOpenChange = (open: boolean) => {
		setIsCreateOpen(open);
		if (!open) {
			setSelectedRoomId(undefined);
		}
	};

	return {
		sessions,
		availableTags,
		isLoading,
		isCreatePending,
		isCreateOpen,
		isTagManagerOpen,
		filters,
		bbBiMode,
		rooms,
		currencies,
		createGames,
		setFilters,
		setBbBiMode,
		setIsTagManagerOpen,
		setSelectedRoomId,
		handleCreate,
		handleCreateOpenChange,
		createTag,
	};
}
