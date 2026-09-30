export function comparableHouseRules(value: string): string {
	return value.replace(/\r\n?/g, "\n").trim();
}

export function houseRulesOrNull(value: string): string | null {
	return value.trim() === "" ? null : value;
}
