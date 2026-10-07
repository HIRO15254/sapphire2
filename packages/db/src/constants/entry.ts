export const ENTRY_KINDS = ["cash", "tournament"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_SOURCES = ["live", "manual", "import"] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const ENTRY_STATUSES = ["open", "settled"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const PLAY_SESSION_STATUSES = ["active", "paused", "ended"] as const;
export type PlaySessionStatus = (typeof PLAY_SESSION_STATUSES)[number];

export const PLAY_SESSION_END_STATES = [
	"bagged",
	"held",
	"busted",
	"cashed_out",
	"finished",
] as const;
export type PlaySessionEndState = (typeof PLAY_SESSION_END_STATES)[number];

export const END_STATE_KINDS = {
	bagged: ["tournament"],
	held: ["cash"],
	busted: ["tournament"],
	cashed_out: ["cash"],
	finished: ["cash", "tournament"],
} as const satisfies Record<PlaySessionEndState, readonly EntryKind[]>;

export const END_STATES_REQUIRING_STACK = [
	"bagged",
	"held",
] as const satisfies readonly PlaySessionEndState[];

export function endStatesForKind(kind: EntryKind): PlaySessionEndState[] {
	return PLAY_SESSION_END_STATES.filter((endState) =>
		(END_STATE_KINDS[endState] as readonly EntryKind[]).includes(kind)
	);
}
