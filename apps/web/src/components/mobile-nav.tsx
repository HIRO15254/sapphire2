import {
	IconBuildingStore,
	IconCards,
	IconCoins,
	IconLayoutDashboard,
	IconPlayerRecord,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";

export interface NavigationItem {
	icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
	label: string;
	to: string;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
	{ to: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
	{ to: "/currencies", label: "Currencies", icon: IconCoins },
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/live-sessions", label: "Live", icon: IconPlayerRecord },
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

export function isActive(currentPath: string, itemPath: string): boolean {
	if (itemPath === "/") {
		return currentPath === "/";
	}
	return currentPath.startsWith(itemPath);
}

export function MobileNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});

	return (
		<nav className="fixed inset-x-0 bottom-0 z-40 border-sidebar-border border-t bg-sidebar md:hidden">
			<ul className="flex h-16 items-center">
				{NAVIGATION_ITEMS.map((item) => {
					const active = isActive(pathname, item.to);
					return (
						<li className="flex-1" key={item.to}>
							<Link
								className={`flex flex-col items-center gap-0.5 py-1.5 text-xs transition-colors ${
									active
										? "font-semibold text-sidebar-primary"
										: "text-sidebar-foreground/60"
								}`}
								to={item.to}
							>
								<item.icon size={24} stroke={active ? 2.5 : 1.5} />
								<span>{item.label}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
