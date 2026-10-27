import {
	IconBuildingStore,
	IconCards,
	IconChartLine,
	IconDots,
	IconHome,
	IconPlayCard,
	IconSettings,
	IconTag,
	IconUsers,
	IconWallet,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface NavigationItem {
	exact?: boolean;
	icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
	label: string;
	to: string;
}

export const NAV_ITEMS: readonly NavigationItem[] = [
	{ to: "/", label: "Home", icon: IconHome, exact: true },
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/stats", label: "Stats", icon: IconChartLine },
	{ to: "/assets", label: "Assets", icon: IconWallet },
];
export const LIBRARY_ITEMS: readonly NavigationItem[] = [
	{ to: "/rooms", label: "Rooms", icon: IconBuildingStore },
	{ to: "/games", label: "Games", icon: IconPlayCard },
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/tags", label: "Tags", icon: IconTag },
];
export const APP_ITEMS: readonly NavigationItem[] = [
	{ to: "/settings", label: "Settings", icon: IconSettings },
];
export const MOBILE_ITEMS: readonly NavigationItem[] = [
	...NAV_ITEMS,
	{ to: "/more", label: "More", icon: IconDots },
];

export function isActive(
	currentPath: string,
	itemPath: string,
	exact = false
): boolean {
	if (itemPath === "/more") {
		return [
			"/more",
			...LIBRARY_ITEMS.map((item) => item.to),
			...APP_ITEMS.map((item) => item.to),
		].some(
			(path) => currentPath === path || currentPath.startsWith(`${path}/`)
		);
	}
	if (itemPath === "/" || exact) {
		return currentPath === itemPath;
	}
	return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export function MobileNavItem({
	active,
	item,
}: {
	active: boolean;
	item: NavigationItem;
}) {
	return (
		<li>
			<Link
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex h-12 flex-col items-center justify-center gap-[3px] font-medium text-[length:var(--m-text-tab)]",
					active ? "text-[var(--accent-text)]" : "text-muted-foreground"
				)}
				to={item.to}
			>
				<item.icon size={24} />
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
		<li>
			<Link
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex h-[30px] w-full items-center gap-2 rounded-md px-2 font-medium text-sm",
					active
						? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
						: "text-muted-foreground hover:bg-[var(--state-hover)] hover:text-foreground"
				)}
				to={item.to}
			>
				<item.icon size={16} />
				<span>{item.label}</span>
			</Link>
		</li>
	);
}
