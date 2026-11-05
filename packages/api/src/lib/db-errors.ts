const FILTER_PRESET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*filter_preset\.user_id,\s*filter_preset\.screen_key,\s*filter_preset\.name(?=\s*(?::|$))/i;

const ASSET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'asset_name_uq'/i;

const ASSET_RATE_CONFLICT_RE =
	/UNIQUE constraint failed:\s*asset_rate\.user_id,\s*asset_rate\.base_asset_id,\s*asset_rate\.quote_asset_id,\s*asset_rate\.effective_from(?=\s*(?::|$))/i;

const LEDGER_CATEGORY_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'ledger_category_user_name_unique'/i;

const GAME_MASTER_LABEL_CONFLICT_RE = {
	game_group_label_uq:
		/UNIQUE constraint failed:\s*index 'game_group_label_uq'/i,
	game_variant_label_uq:
		/UNIQUE constraint failed:\s*index 'game_variant_label_uq'/i,
	game_mix_label_uq: /UNIQUE constraint failed:\s*index 'game_mix_label_uq'/i,
} as const;

const FOREIGN_KEY_FAILED_RE = /FOREIGN KEY constraint failed/i;

const UNFINISHED_PLAY_SESSION_CONFLICT_RE =
	/UNIQUE constraint failed:\s*(?:play_session\.user_id(?=\s*(?::|$))|index 'play_session_one_unfinished_per_user_idx')/i;

const PLAY_EVENT_ORDER_CONFLICT_RE =
	/UNIQUE constraint failed:\s*(?:play_event\.entry_id,\s*play_event\.sort_order(?=\s*(?::|$))|index 'play_event_entry_sort_order_unique')/i;

const ENDED_PLAY_APPEND_RE =
	/NOT NULL constraint failed:\s*play_session\.status(?=\s*(?::|$))/i;

const PLAY_SEQ_CONFLICT_RE =
	/UNIQUE constraint failed:\s*(?:play_session\.entry_id,\s*play_session\.seq(?=\s*(?::|$))|index 'play_session_entry_seq_unique')/i;

const DISCARDED_PLAY_DEPENDENT_RE =
	/NOT NULL constraint failed:\s*play_session\.seq(?=\s*(?::|$))/i;

function someErrorInChain(error: unknown, pattern: RegExp): boolean {
	let current = error;
	const seen = new Set<Error>();
	while (current instanceof Error && !seen.has(current)) {
		seen.add(current);
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

export function isPlaySeqConflictError(error: unknown): boolean {
	return someErrorInChain(error, PLAY_SEQ_CONFLICT_RE);
}

export function isDiscardedPlayDependentError(error: unknown): boolean {
	return someErrorInChain(error, DISCARDED_PLAY_DEPENDENT_RE);
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

export function isUniqueIndexConflictError(
	error: unknown,
	index: string
): boolean {
	return someErrorInChain(
		error,
		new RegExp(
			`UNIQUE constraint failed:\\s*index '${index.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`,
			"i"
		)
	);
}

export function isGameMasterLabelConflictError(
	error: unknown,
	index: keyof typeof GAME_MASTER_LABEL_CONFLICT_RE
): boolean {
	return someErrorInChain(error, GAME_MASTER_LABEL_CONFLICT_RE[index]);
}

export function isFilterPresetNameConflictError(error: unknown): boolean {
	return someErrorInChain(error, FILTER_PRESET_NAME_CONFLICT_RE);
}
