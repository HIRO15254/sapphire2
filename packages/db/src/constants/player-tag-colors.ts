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
