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
	const totalMinutes = Math.floor(diffMs / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
