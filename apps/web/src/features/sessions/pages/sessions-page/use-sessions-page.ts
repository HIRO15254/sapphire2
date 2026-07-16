import { useEffect, useRef, useState } from "react";
import {
	useEntityLists,
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";
import { useSessions } from "@/features/sessions/hooks/use-sessions";
import type { SessionFilterValues } from "@/features/sessions/utils/session-filters-helpers";
import { useFilterPresets } from "@/shared/hooks/use-filter-presets";

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

	const {
		presets,
		defaultPreset,
		isLoading: isPresetsLoading,
		isCreatePending: isPresetCreatePending,
		isDeletePending: isPresetDeletePending,
		isSetDefaultPending: isPresetSetDefaultPending,
		create: createPreset,
		remove: removePreset,
		setDefault: setDefaultPreset,
		clearDefault: clearDefaultPreset,
	} = useFilterPresets("sessions");

	// Auto-apply the screen's default preset on first load, but only if the
	// user hasn't already touched a filter (e.g. via a deep link or a fast
	// click before the presets query resolves). The ref guard makes this a
	// one-shot attempt: once it has run, later changes to `presets` or
	// `filters` never trigger a second auto-apply.
	const hasAttemptedDefaultPresetRef = useRef(false);

	useEffect(() => {
		if (hasAttemptedDefaultPresetRef.current || isPresetsLoading) {
			return;
		}
		hasAttemptedDefaultPresetRef.current = true;
		if (Object.keys(filters).length > 0) {
			return;
		}
		const defaultPresetEntry = presets.find((p) => p.isDefault);
		if (defaultPresetEntry) {
			setFilters(defaultPresetEntry.payload as SessionFilterValues);
		}
	}, [isPresetsLoading, presets, filters, setFilters]);

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
		presets,
		defaultPreset,
		isPresetsLoading,
		isPresetCreatePending,
		isPresetDeletePending,
		isPresetSetDefaultPending,
		createPreset,
		removePreset,
		setDefaultPreset,
		clearDefaultPreset,
	};
}
