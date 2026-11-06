const dateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	weekday: "short",
});

export function useHomePage() {
	return { todayLabel: dateFormatter.format(new Date()) };
}
