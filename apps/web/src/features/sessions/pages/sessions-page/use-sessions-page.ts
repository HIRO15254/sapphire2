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

	// "Untouched" has to mean "no field holds a real value", not "the object has
	// no keys": the filter bar's `patch` helper spreads `{ ...filters, ...next }`
	// and several of its handlers deliberately write `undefined` (Type → "All",
	// Room / Currency → cleared), so those keys linger forever. Counting keys
	// made a single cleared chip look like an active filter and silently
	// suppressed the default preset (review finding 1).
	//
	// The Display chip is part of the same verdict even though `bbBiMode` is not a
	// `filters` key: a sessions preset payload carries `display`, so a user who
	// picks BB/BI before the presets query resolves would otherwise still count as
	// pristine and have their view silently overwritten. Statistics needs no
	// equivalent flag because its `norm` lives in the URL.
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
			// Absent `display` = a preset saved before the field existed; keep the
			// current view instead of forcing it back to currency.
			if (display !== undefined) {
				// Raw setter on purpose: this write is the auto-apply's own, so it must
				// not mark the Display control touched (the hook would be flagging
				// itself).
				setBbBiModeState(display === "normalized");
			}
		}
	);

	/**
	 * User-facing Display setter (the filter bar's Display chip and its manual
	 * "apply preset" action). Every external write is an explicit view choice, so
	 * it records the touch — even when the value ends up unchanged.
	 */
	const setBbBiMode = (value: boolean) => {
		setIsDisplayTouched(true);
		setBbBiModeState(value);
	};

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
