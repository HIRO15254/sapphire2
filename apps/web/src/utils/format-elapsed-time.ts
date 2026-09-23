export function formatHoursMinutes(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatElapsedTime(
	startedAt: Date | string | number | null | undefined
): string {
	if (startedAt === null || startedAt === undefined) {
		return "—";
	}
	const start = new Date(startedAt);
	const diffMs = Date.now() - start.getTime();
	if (Number.isNaN(diffMs) || diffMs < 0) {
		return "—";
	}
	return formatHoursMinutes(Math.floor(diffMs / 60_000));
}
