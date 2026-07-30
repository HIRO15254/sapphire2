import type { SessionsFilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { PERIOD_LABEL, PERIODS, type Period } from "@/shared/lib/period-filter";

// The sessions list reuses the shared Period domain (preset windows + custom
// range) so its filter header behaves identically to statistics (SA2-74).
export type SessionPeriod = Period;
export const SESSION_PERIODS = PERIODS;
export const SESSION_PERIOD_LABEL = PERIOD_LABEL;

export interface SessionFilterValues {
	currencyId?: string;
	/** Custom-range lower bound, Unix seconds. Only used when `period` is `custom`. */
	from?: number;
	period?: SessionPeriod;
	roomId?: string;
	/** Custom-range upper bound, Unix seconds. Only used when `period` is `custom`. */
	to?: number;
	type?: "cash_game" | "tournament";
}

export const SESSION_TYPE_VALUES = ["all", "cash_game", "tournament"] as const;
export type SessionTypeValue = (typeof SESSION_TYPE_VALUES)[number];

export const SESSION_TYPE_LABEL: Record<SessionTypeValue, string> = {
	all: "All",
	cash_game: "Cash",
	tournament: "Tournament",
};

// Display mode = how a session's P&L is shown: raw currency vs BB/BI normalized.
// One label map drives both the chip and the sheet options so the wording can't
// drift (mirrors statistics' single STATS_NORMALIZATION_LABEL).
export const SESSION_DISPLAY_VALUES = ["currency", "normalized"] as const;
export type SessionDisplayValue = (typeof SESSION_DISPLAY_VALUES)[number];

export const SESSION_DISPLAY_LABEL: Record<SessionDisplayValue, string> = {
	currency: "Currency",
	normalized: "BB / BI",
};

// ---------------------------------------------------------------------------
// Filter preset payload <-> screen state
//
// A sessions preset stores the filter values PLUS the Display (BB/BI) mode.
// Display is not a `SessionFilterValues` key — it is a page-level boolean that
// changes how amounts are rendered, not what the list queries — so joining and
// splitting it needs an explicit pair of helpers. Statistics keeps its
// equivalent (`norm`) inside its own filter object and therefore needs none;
// without these two, saving "Cash / Room X / BB view" restored the filters but
// silently dropped the view (review finding 7).
//
// Both live here (rather than inline in the two apply paths) because the
// default-preset auto-apply in `use-sessions-page.ts` and the manual apply in
// `use-session-filter-bar.ts` must not drift apart.
// ---------------------------------------------------------------------------

/** Composes the payload the presets sheet saves for the sessions screen. */
export function buildSessionsPresetPayload(
	filters: SessionFilterValues,
	bbBiMode: boolean
): SessionsFilterPresetPayload {
	return { ...filters, display: bbBiMode ? "normalized" : "currency" };
}

/**
 * Inverse of `buildSessionsPresetPayload`.
 *
 * `display` is stripped from the filter half on purpose: it is not a
 * `SessionFilterValues` key, and `patch`'s `{ ...filters, ...next }` spread in
 * `use-session-filter-bar.ts` would otherwise carry it along forever and
 * re-save it into every later preset.
 *
 * A returned `display` of `undefined` means "this preset has no opinion" —
 * presets saved before the field existed omit it, and the caller must leave the
 * current view alone rather than resetting it to currency.
 */
export function splitSessionsPresetPayload(
	payload: SessionsFilterPresetPayload
): { display: SessionDisplayValue | undefined; filters: SessionFilterValues } {
	const { display, ...filters } = payload;
	return {
		display,
		// `period` is only a bounded string in the shared db schema (packages/db
		// cannot import the fuller `Period` vocabulary — see filter-preset.ts), so
		// a structural assignment does not narrow. Safe: sessions presets are only
		// ever written from this screen's own `SESSION_PERIODS`.
		filters: filters as SessionFilterValues,
	};
}
