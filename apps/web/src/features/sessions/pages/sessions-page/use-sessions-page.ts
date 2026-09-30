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

export function useSessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
	const [filters, setFilters] = useState<SessionFilterValues>({});
	const [bbBiMode, setBbBiModeState] = useState(false);
	const [isDisplayTouched, setIsDisplayTouched] = useState(false);

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

	const isUntouched = !(
		isDisplayTouched || Object.values(filters).some((v) => v !== undefined)
	);

	useDefaultFilterPreset<SessionsFilterPresetPayload>(
		"sessions",
		isUntouched,
		(payload) => {
			const { display, filters: presetFilters } =
				splitSessionsPresetPayload(payload);
			setFilters(presetFilters);
			if (display !== undefined) {
				setBbBiModeState(display === "normalized");
			}
		}
	);

	const setBbBiMode = (value: boolean) => {
		setIsDisplayTouched(true);
		setBbBiModeState(value);
	};

	const handleCreate = (values: SessionFormValues) => {
		create(values).then(
			() => {
				setIsCreateOpen(false);
				setSelectedRoomId(undefined);
			},
			() => undefined
		);
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
