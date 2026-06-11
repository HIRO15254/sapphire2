import type {
	PnlGraphSessionType,
	PnlGraphUnit,
	PnlGraphXAxis,
} from "./use-pnl-graph-widget";

export const X_AXIS_LABEL: Record<PnlGraphXAxis, string> = {
	date: "Date",
	sessionCount: "Session #",
	playTime: "Play Time (h)",
};

export const SESSION_TYPE_LABEL: Record<PnlGraphSessionType, string> = {
	all: "All",
	cash_game: "Cash Game",
	tournament: "Tournament",
};

export const UNIT_LABEL: Record<PnlGraphUnit, string> = {
	currency: "Actual Value",
	normalized: "Normalized (BB / BI)",
};

export const NONE_VALUE = "__none__";
export const ALL_VALUE = "__all__";
