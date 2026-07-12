// Single source for the ante-type select options. Three forms render the
// same enum (ring-game form, session-wizard cash fields, mix-games editor);
// keeping one list stops the sentence-case copy from drifting per form.
export const ANTE_TYPE_OPTIONS = [
	{ value: "none", label: "No ante" },
	{ value: "bb", label: "BB ante" },
	{ value: "all", label: "All ante" },
] as const;
