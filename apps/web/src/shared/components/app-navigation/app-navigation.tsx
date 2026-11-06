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

export const MOBILE_ITEMS: readonly NavigationItem[] = [
	{ exact: true, icon: IconHome, label: "Home", to: "/" },
	{ icon: IconCards, label: "Sessions", to: "/sessions" },
	{ icon: IconChartLine, label: "Stats", to: "/stats" },
	{ icon: IconWallet, label: "Assets", to: "/assets" },
	{ icon: IconDots, label: "More", to: "/more" },
];
export const LIBRARY_ITEMS: readonly NavigationItem[] = [
	{ icon: IconBuildingStore, label: "Rooms", to: "/rooms" },
	{ icon: IconPlayCard, label: "Games", to: "/games" },
	{ icon: IconUsers, label: "Players", to: "/players" },
	{ icon: IconTag, label: "Tags", to: "/tags" },
];
export const APP_ITEMS: readonly NavigationItem[] = [
	{ icon: IconSettings, label: "Settings", to: "/settings" },
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
					active ? "text-primary-text" : "text-muted-foreground"
				)}
				to={item.to}
			>
				<item.icon size={24} />
				<span>{item.label}</span>
			</Link>
		</li>
	);
}
