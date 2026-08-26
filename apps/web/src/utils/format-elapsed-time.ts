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

export function formatClockElapsed(
	startedAt: Date | string | number | null | undefined
): string {
	if (startedAt === null || startedAt === undefined) {
		return "—";
	}
	const diffMs = Date.now() - new Date(startedAt).getTime();
	if (Number.isNaN(diffMs) || diffMs < 0) {
		return "—";
	}
	const totalSeconds = Math.floor(diffMs / 1000);
	const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
	const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
		2,
		"0"
	);
	const seconds = String(totalSeconds % 60).padStart(2, "0");
	return `${hours}:${minutes}:${seconds}`;
}
