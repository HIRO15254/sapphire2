export function plToneClass(value: number | null | undefined): string {
	if (value === null || value === undefined || value === 0) {
		return "";
	}
	return value > 0 ? "text-success" : "text-destructive";
}
