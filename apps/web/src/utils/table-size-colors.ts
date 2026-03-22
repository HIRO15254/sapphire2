export const TABLE_SIZE_COLORS: Record<number, string> = {
	2: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	3: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
	4: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	5: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
	6: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
	7: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	8: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
	9: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	10: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export function getTableSizeClassName(size: number): string {
	return TABLE_SIZE_COLORS[size] ?? "bg-muted text-muted-foreground";
}
