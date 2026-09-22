export const TABLE_PLAYER_SOURCE_APP_IDS = ["dmm_waitinglist"] as const;

export type TablePlayerSourceApp = (typeof TABLE_PLAYER_SOURCE_APP_IDS)[number];

interface TablePlayerSourceAppConfig {
	label: string;
	prompt: string;
}

export const TABLE_PLAYER_SOURCE_APPS: Record<
	TablePlayerSourceApp,
	TablePlayerSourceAppConfig
> = {
	dmm_waitinglist: {
		label: "DMM Waitinglist",
		prompt: `The image is a table view from the DMM Waitinglist app.
Extract the player name at each seat.

Seat numbering rules:
- The table graphic has a notch cut into its bottom edge. Counting clockwise from
  that notch, the seats are numbered 1, 2, 3, ... The notch is a landmark on the
  table edge, not a seat itself.
- Empty seats have their seat number stamped on them. Where a stamped number is
  readable it is authoritative: read it directly instead of inferring it, and use
  it to anchor the numbering of the occupied seats around it.

Hero detection:
- The name of the user who is using this app is displayed at the top area of the screen (typically next to an account icon / header).
- For each seat in the \`seats\` array, set \`isHero: true\` when that seat's player name is identical to the user name displayed at the top of the screen. Otherwise set \`isHero: false\`.
- If you cannot confidently read the user name at the top, or you cannot confidently match it to any seat, set \`isHero: null\` for every seat you return.
- At most one seat should have \`isHero: true\`.

Extraction rules:
- Include only seats whose names are readable in the \`seats\` array.
- A seat with nobody seated shows only that stamped seat number and no player name. Treat those as empty seats.
- Omit empty seats and seats whose names are unclear.
- Return only the player name; strip surrounding symbols, decorations, and stack / chip count displays.
- Player names may be in Japanese (hiragana, katakana, kanji), English, or a mix. Preserve the exact characters as shown, do not translate or romanize.`,
	},
};
