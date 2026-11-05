const FILTER_PRESET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*filter_preset\.user_id,\s*filter_preset\.screen_key,\s*filter_preset\.name/i;

const ASSET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'asset_name_uq'/i;

const ASSET_RATE_CONFLICT_RE =
	/UNIQUE constraint failed:\s*asset_rate\.user_id,\s*asset_rate\.base_asset_id,\s*asset_rate\.quote_asset_id,\s*asset_rate\.effective_from/i;

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
		new RegExp(`UNIQUE constraint failed:\\s*index '${index}'`, "i")
	);
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
