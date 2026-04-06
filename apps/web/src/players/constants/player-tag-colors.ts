export const TAG_COLOR_NAMES = [
	"gray",
	"red",
	"orange",
	"yellow",
	"green",
	"blue",
	"purple",
	"pink",
] as const;

export type TagColor = (typeof TAG_COLOR_NAMES)[number];

export const TAG_COLORS: Record<TagColor, { bg: string; text: string }> = {
	gray: {
		bg: "bg-gray-100 dark:bg-gray-800",
		text: "text-gray-700 dark:text-gray-300",
	},
	red: {
		bg: "bg-red-100 dark:bg-red-900",
		text: "text-red-700 dark:text-red-300",
	},
	orange: {
		bg: "bg-orange-100 dark:bg-orange-900",
		text: "text-orange-700 dark:text-orange-300",
	},
	yellow: {
		bg: "bg-yellow-100 dark:bg-yellow-900",
		text: "text-yellow-700 dark:text-yellow-300",
	},
	green: {
		bg: "bg-green-100 dark:bg-green-900",
		text: "text-green-700 dark:text-green-300",
	},
	blue: {
		bg: "bg-blue-100 dark:bg-blue-900",
		text: "text-blue-700 dark:text-blue-300",
	},
	purple: {
		bg: "bg-purple-100 dark:bg-purple-900",
		text: "text-purple-700 dark:text-purple-300",
	},
	pink: {
		bg: "bg-pink-100 dark:bg-pink-900",
		text: "text-pink-700 dark:text-pink-300",
	},
};
