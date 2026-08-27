const DOT_COLOR_BY_TAG: Record<string, string> = {
	blue: "var(--info)",
	gray: "var(--muted-foreground)",
	green: "var(--success)",
	orange: "var(--warning)",
	pink: "var(--primary)",
	purple: "var(--primary)",
	red: "var(--destructive)",
	yellow: "var(--warning)",
};

export const DEFAULT_SEAT_DOT_COLOR = "var(--muted-foreground)";

export function seatDotColor(
	tags: { color?: string | null }[] | null | undefined
): string {
	const color = tags?.[0]?.color;
	if (!color) {
		return DEFAULT_SEAT_DOT_COLOR;
	}
	return DOT_COLOR_BY_TAG[color] ?? DEFAULT_SEAT_DOT_COLOR;
}
