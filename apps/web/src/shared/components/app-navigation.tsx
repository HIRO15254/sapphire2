import {
	type IconBolt,
	IconBuildingStore,
	IconCards,
	IconLayoutDashboard,
	IconList,
	type IconPlus,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

export interface NavigationItem {
	exact?: boolean;
	icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
	label: string;
	to: string;
}

export interface NavigationCenterAction {
	icon: typeof IconPlus | typeof IconBolt;
	label: string;
	onClick: () => void;
	tone: "accent" | "live";
}

export const SIDEBAR_ITEMS: readonly NavigationItem[] = [
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

const NORMAL_LEFT_ITEMS: readonly NavigationItem[] = [
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
] as const;

const NORMAL_RIGHT_ITEMS: readonly NavigationItem[] = [
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

const LIVE_LEFT_ITEMS: readonly NavigationItem[] = [
	{ to: "/active-session/events", label: "Events", icon: IconList },
	{ to: "/players", label: "Players", icon: IconUsers },
] as const;

const LIVE_RIGHT_ITEMS: readonly NavigationItem[] = [
	{
		to: "/active-session",
		label: "Overview",
		icon: IconLayoutDashboard,
		exact: true,
	},
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

export const NORMAL_NAV_ITEMS: readonly NavigationItem[] = [
	...NORMAL_LEFT_ITEMS,
	...NORMAL_RIGHT_ITEMS,
] as const;

export function isActive(
	currentPath: string,
	itemPath: string,
	exact = false
): boolean {
	if (itemPath === "/" || exact) {
		return currentPath === itemPath;
	}
	return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export function getMobileNavigationItems(hasActive: boolean): {
	leftItems: readonly NavigationItem[];
	rightItems: readonly NavigationItem[];
} {
	return hasActive
		? { leftItems: LIVE_LEFT_ITEMS, rightItems: LIVE_RIGHT_ITEMS }
		: { leftItems: NORMAL_LEFT_ITEMS, rightItems: NORMAL_RIGHT_ITEMS };
}

export function MobileNavItem({
	active,
	item,
}: {
	active: boolean;
	item: NavigationItem;
}) {
	return (
		<li className="flex-1">
			<Link
				className={cn(
					"flex flex-col items-center gap-0.5 py-1.5 text-xs transition-colors",
					active
						? "font-semibold text-sidebar-primary"
						: "text-sidebar-foreground/60"
				)}
				to={item.to}
			>
				<item.icon size={22} stroke={active ? 2.5 : 1.5} />
				<span>{item.label}</span>
			</Link>
		</li>
	);
}

export function SidebarNavItem({
	active,
	item,
}: {
	active: boolean;
	item: NavigationItem;
}) {
	return (
		<li key={item.to}>
			<Link
				className={cn(
					"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
					active
						? "bg-sidebar-accent font-semibold text-sidebar-primary"
						: "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
				)}
				to={item.to}
			>
				<item.icon size={20} stroke={active ? 2.5 : 1.5} />
				<span>{item.label}</span>
			</Link>
		</li>
	);
}

export function NavigationCenterButton({
	action,
}: {
	action: NavigationCenterAction;
}) {
	const Icon = action.icon;
	const isLive = action.tone === "live";

	return (
		<Button
			className="relative h-16 w-full overflow-visible bg-transparent p-0 hover:bg-transparent"
			onClick={action.onClick}
			type="button"
			variant="ghost"
		>
			<div
				className={cn(
					"absolute top-[-10px] left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full shadow-lg transition-colors",
					isLive
						? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
						: "bg-primary text-primary-foreground hover:bg-primary/90"
				)}
			>
				<Icon className="size-8" size={32} stroke={2} />
			</div>
			<span
				className={cn(
					"absolute bottom-1.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-px font-bold text-[10px]",
					isLive
						? "bg-green-600 text-white dark:bg-green-500"
						: "bg-primary text-primary-foreground"
				)}
			>
				{action.label}
			</span>
		</Button>
	);
}
