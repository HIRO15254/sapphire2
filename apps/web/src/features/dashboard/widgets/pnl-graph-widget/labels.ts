import type {
	PnlGraphSessionType,
	PnlGraphUnit,
	PnlGraphXAxis,
} from "./use-pnl-graph-widget";

export const X_AXIS_LABEL: Record<PnlGraphXAxis, string> = {
	date: "Date",
	sessionCount: "Session #",
	playTime: "Play time (h)",
};

export const SESSION_TYPE_LABEL: Record<PnlGraphSessionType, string> = {
	all: "All",
	cash_game: "Cash game",
	tournament: "Tournament",
};

export const UNIT_LABEL: Record<PnlGraphUnit, string> = {
	currency: "Actual value",
	normalized: "Normalized (BB / BI)",
};

export const NONE_VALUE = "__none__";
export const ALL_VALUE = "__all__";
