import type { SessionsFilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";
import { useSessions } from "@/features/sessions/hooks/use-sessions";
import type { SessionFilterValues } from "@/features/sessions/utils/session-filters-helpers";
import { splitSessionsPresetPayload } from "@/features/sessions/utils/session-filters-helpers";
import { useDefaultFilterPreset } from "@/shared/hooks/use-default-filter-preset";

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
		isInitialLoadError,
		onRetry,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		isCreatePending,
		create,
		createTag,
	} = useSessions(filters);

	const { rooms, currencies } = useEntityLists();
	const createGames = useRoomGames(selectedRoomId);

	// "Untouched" has to mean "no field holds a real value", not "the object has
	// no keys": the filter bar's `patch` helper spreads `{ ...filters, ...next }`
	// and several of its handlers deliberately write `undefined` (Type → "All",
	// Room / Currency → cleared), so those keys linger forever. Counting keys
	// made a single cleared chip look like an active filter and silently
	// suppressed the default preset (review finding 1).
	const isUntouched = !Object.values(filters).some((v) => v !== undefined);

	useDefaultFilterPreset<SessionsFilterPresetPayload>(
		"sessions",
		isUntouched,
		(payload) => {
			const { display, filters: presetFilters } =
				splitSessionsPresetPayload(payload);
			setFilters(presetFilters);
			// Absent `display` = a preset saved before the field existed; keep the
			// current view instead of forcing it back to currency.
			if (display !== undefined) {
				setBbBiMode(display === "normalized");
			}
		}
	);

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
		isInitialLoadError,
		onRetry,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
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
