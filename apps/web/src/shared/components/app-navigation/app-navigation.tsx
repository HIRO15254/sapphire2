import { IconHome, IconSettings } from "@tabler/icons-react";
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
	{ to: "/settings", label: "Settings", icon: IconSettings },
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
				aria-current={active ? "page" : undefined}
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
				aria-current={active ? "page" : undefined}
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
