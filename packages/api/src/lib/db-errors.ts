const LABEL_CONFLICT_RE = /UNIQUE constraint failed|label already exists/i;

const FILTER_PRESET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*filter_preset\.user_id,\s*filter_preset\.screen_key,\s*filter_preset\.name/i;

const ASSET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*index 'asset_name_uq'/i;

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

export function isLabelConflictError(error: unknown): boolean {
	return error instanceof Error && LABEL_CONFLICT_RE.test(error.message);
}

export function isFilterPresetNameConflictError(error: unknown): boolean {
	return (
		error instanceof Error && FILTER_PRESET_NAME_CONFLICT_RE.test(error.message)
	);
}
