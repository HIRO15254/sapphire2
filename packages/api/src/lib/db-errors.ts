const FILTER_PRESET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*filter_preset\.user_id,\s*filter_preset\.screen_key,\s*filter_preset\.name/i;

const ASSET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'asset_name_uq'/i;

const ASSET_RATE_CONFLICT_RE =
	/UNIQUE constraint failed:\s*asset_rate\.user_id,\s*asset_rate\.base_asset_id,\s*asset_rate\.quote_asset_id,\s*asset_rate\.effective_from/i;

const LEDGER_CATEGORY_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'ledger_category_user_name_unique'/i;

const ENTRY_TAG_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'entry_tag_name_uq'/i;

const GAME_MASTER_LABEL_CONFLICT_RE = {
	game_group_label_uq:
		/UNIQUE constraint failed:\s*index 'game_group_label_uq'/i,
	game_variant_label_uq:
		/UNIQUE constraint failed:\s*index 'game_variant_label_uq'/i,
	game_mix_label_uq: /UNIQUE constraint failed:\s*index 'game_mix_label_uq'/i,
} as const;

const FOREIGN_KEY_FAILED_RE = /FOREIGN KEY constraint failed/i;

const UNFINISHED_PLAY_SESSION_CONFLICT_RE =
	/UNIQUE constraint failed:\s*(play_session\.user_id|index 'play_session_one_unfinished_per_user_idx')/i;

const PLAY_EVENT_ORDER_CONFLICT_RE =
	/UNIQUE constraint failed:\s*(play_event\.entry_id,\s*play_event\.sort_order|index 'play_event_entry_sort_order_unique')/i;

const ENDED_PLAY_APPEND_RE =
	/NOT NULL constraint failed:\s*play_session\.status/i;

function someErrorInChain(error: unknown, pattern: RegExp): boolean {
	let current = error;
	while (current instanceof Error) {
		if (pattern.test(current.message)) {
			return true;
		}
		current = current.cause;
	}
	return false;
}

export function isForeignKeyConstraintError(error: unknown): boolean {
	return someErrorInChain(error, FOREIGN_KEY_FAILED_RE);
}

export function isUnfinishedPlaySessionConflictError(error: unknown): boolean {
	return someErrorInChain(error, UNFINISHED_PLAY_SESSION_CONFLICT_RE);
}

export function isPlayEventOrderConflictError(error: unknown): boolean {
	return someErrorInChain(error, PLAY_EVENT_ORDER_CONFLICT_RE);
}

export function isEndedPlayAppendError(error: unknown): boolean {
	return someErrorInChain(error, ENDED_PLAY_APPEND_RE);
}

export function isAssetNameConflictError(error: unknown): boolean {
	return someErrorInChain(error, ASSET_NAME_CONFLICT_RE);
}

export function isAssetRateConflictError(error: unknown): boolean {
	return someErrorInChain(error, ASSET_RATE_CONFLICT_RE);
}

export function isLedgerCategoryNameConflictError(error: unknown): boolean {
	return someErrorInChain(error, LEDGER_CATEGORY_NAME_CONFLICT_RE);
}

export function isEntryTagNameConflictError(error: unknown): boolean {
	return someErrorInChain(error, ENTRY_TAG_NAME_CONFLICT_RE);
}

export function isGameMasterLabelConflictError(
	error: unknown,
	index: keyof typeof GAME_MASTER_LABEL_CONFLICT_RE
): boolean {
	return someErrorInChain(error, GAME_MASTER_LABEL_CONFLICT_RE[index]);
}

export function isFilterPresetNameConflictError(error: unknown): boolean {
	return (
		error instanceof Error && FILTER_PRESET_NAME_CONFLICT_RE.test(error.message)
	);
}
