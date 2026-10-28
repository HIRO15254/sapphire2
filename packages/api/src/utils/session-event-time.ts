export function floorToMinute(date: Date): Date {
	const copy = new Date(date);
	copy.setSeconds(0, 0);
	return copy;
}
