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
- The seat with the notch at the bottom-center of the screen is seat number 1.
- Number the remaining seats clockwise: 2, 3, 4, ...
- Up to 9 seats per table (seatNumber is an integer from 1 to 9).

Extraction rules:
- Include only seats whose names are readable in the \`seats\` array.
- Omit empty seats and seats whose names are unclear.
- Return only the player name; strip surrounding symbols, decorations, and stack / chip count displays.
- Player names may be in Japanese (hiragana, katakana, kanji), English, or a mix. Preserve the exact characters as shown, do not translate or romanize.`,
	},
};
