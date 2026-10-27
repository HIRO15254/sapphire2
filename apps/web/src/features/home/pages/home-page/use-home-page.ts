const dateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
});

export function useHomePage() {
	return { todayLabel: dateFormatter.format(new Date()) };
}
