import type { TablerIcon } from "@tabler/icons-react";
import {
	IconBolt,
	IconChartLine,
	IconCoin,
	IconListDetails,
	IconReportAnalytics,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import type { WidgetType } from "@/features/dashboard/hooks/use-dashboard-widgets";

export interface WidgetSize {
	h: number;
	w: number;
}

export interface WidgetRegistryEntry {
	defaultSize: { desktop: WidgetSize; mobile: WidgetSize };
	description: string;
	EditForm?: ComponentType<WidgetEditProps>;
	icon: TablerIcon;
	label: string;
	minSize: WidgetSize;
	Render: ComponentType<WidgetRenderProps>;
	type: WidgetType;
}

export interface WidgetRenderProps {
	config: Record<string, unknown>;
	widgetId: string;
}

export interface WidgetEditProps {
	config: Record<string, unknown>;
	onCancel: () => void;
	onSave: (nextConfig: Record<string, unknown>) => Promise<unknown> | undefined;
	widgetId: string;
}

import {
	ActiveSessionEditForm,
	ActiveSessionWidget,
} from "../active-session-widget";
import {
	CurrencyBalanceEditForm,
	CurrencyBalanceWidget,
} from "../currency-balance-widget";
import { PnlGraphEditForm, PnlGraphWidget } from "../pnl-graph-widget";
import {
	RecentSessionsEditForm,
	RecentSessionsWidget,
} from "../recent-sessions-widget";
import {
	SummaryStatsEditForm,
	SummaryStatsWidget,
} from "../summary-stats-widget";

export const widgetRegistry: Record<WidgetType, WidgetRegistryEntry> = {
	summary_stats: {
		type: "summary_stats",
		label: "Summary Stats",
		description: "Aggregated P/L, win rate, and session counts",
		icon: IconReportAnalytics,
		Render: SummaryStatsWidget,
		EditForm: SummaryStatsEditForm,
		defaultSize: {
			desktop: { w: 6, h: 4 },
			mobile: { w: 6, h: 4 },
		},
		minSize: { w: 2, h: 2 },
	},
	recent_sessions: {
		type: "recent_sessions",
		label: "Recent Sessions",
		description: "Cards for the most recent sessions",
		icon: IconListDetails,
		Render: RecentSessionsWidget,
		EditForm: RecentSessionsEditForm,
		defaultSize: {
			desktop: { w: 6, h: 6 },
			mobile: { w: 6, h: 6 },
		},
		minSize: { w: 2, h: 4 },
	},
	active_session: {
		type: "active_session",
		label: "Active Session",
		description: "Live cash/tournament session progress",
		icon: IconBolt,
		Render: ActiveSessionWidget,
		EditForm: ActiveSessionEditForm,
		defaultSize: {
			desktop: { w: 6, h: 4 },
			mobile: { w: 6, h: 4 },
		},
		minSize: { w: 2, h: 2 },
	},
	currency_balance: {
		type: "currency_balance",
		label: "Currency Balance",
		description: "Total balance for a chosen currency",
		icon: IconCoin,
		Render: CurrencyBalanceWidget,
		EditForm: CurrencyBalanceEditForm,
		defaultSize: {
			desktop: { w: 3, h: 2 },
			mobile: { w: 3, h: 2 },
		},
		minSize: { w: 2, h: 2 },
	},
	pnl_graph: {
		type: "pnl_graph",
		label: "P&L Graph",
		description: "Cumulative profit and loss over time, sessions, or play time",
		icon: IconChartLine,
		Render: PnlGraphWidget,
		EditForm: PnlGraphEditForm,
		defaultSize: {
			desktop: { w: 6, h: 5 },
			mobile: { w: 6, h: 4 },
		},
		minSize: { w: 3, h: 3 },
	},
};

export function listWidgetTypes(): WidgetRegistryEntry[] {
	return Object.values(widgetRegistry);
}

export function getWidgetEntry(type: WidgetType): WidgetRegistryEntry {
	return widgetRegistry[type];
}
