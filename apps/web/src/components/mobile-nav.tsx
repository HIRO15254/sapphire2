import {
	IconBuildingStore,
	IconCards,
	IconList,
	IconPlayerRecord,
	IconPlus,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useActiveSession } from "@/hooks/use-active-session";
import { cn } from "@/lib/utils";

export interface NavigationItem {
	icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
	label: string;
	to: string;
}

// Sidebar (desktop) items - all items always visible
export const SIDEBAR_ITEMS: readonly NavigationItem[] = [
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/live-sessions", label: "Live", icon: IconPlayerRecord },
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

// Normal mode: info browsing & editing
const NORMAL_LEFT_ITEMS: readonly NavigationItem[] = [
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
] as const;

const NORMAL_RIGHT_ITEMS: readonly NavigationItem[] = [
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

// Live session mode: session recording focused
const LIVE_LEFT_ITEMS: readonly NavigationItem[] = [
	{ to: "/live-sessions", label: "Events", icon: IconList },
	{ to: "/players", label: "Players", icon: IconUsers },
] as const;

const LIVE_RIGHT_ITEMS: readonly NavigationItem[] = [
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;

// Exported for tests
export const NORMAL_NAV_ITEMS: readonly NavigationItem[] = [
	...NORMAL_LEFT_ITEMS,
	...NORMAL_RIGHT_ITEMS,
] as const;

export const LIVE_NAV_ITEMS: readonly NavigationItem[] = [
	...LIVE_LEFT_ITEMS,
	...LIVE_RIGHT_ITEMS,
] as const;

export function isActive(currentPath: string, itemPath: string): boolean {
	if (itemPath === "/") {
		return currentPath === "/";
	}
	return currentPath.startsWith(itemPath);
}

function NavItem({ item, active }: { item: NavigationItem; active: boolean }) {
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

function CenterButton({
	hasActiveSession,
	activeSessionPath,
}: {
	hasActiveSession: boolean;
	activeSessionPath: string | null;
}) {
	const navigate = useNavigate();

	const handleClick = () => {
		if (hasActiveSession && activeSessionPath) {
			navigate({ to: activeSessionPath });
		} else {
			navigate({ to: "/live-sessions" });
		}
	};

	return (
		<li className="flex-1">
			<button
				className={cn(
					"mx-auto flex size-14 -translate-y-3 items-center justify-center rounded-full shadow-lg transition-colors",
					hasActiveSession
						? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
						: "bg-primary text-primary-foreground hover:bg-primary/90"
				)}
				onClick={handleClick}
				type="button"
			>
				{hasActiveSession ? (
					<IconPlayerRecord size={28} stroke={2} />
				) : (
					<IconPlus size={28} stroke={2} />
				)}
			</button>
			<span
				className={cn(
					"block text-center text-[10px]",
					hasActiveSession
						? "font-semibold text-green-600 dark:text-green-400"
						: "text-sidebar-foreground/60"
				)}
			>
				{hasActiveSession ? "Live" : "New"}
			</span>
		</li>
	);
}

export function MobileNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const { activeSession, hasActive } = useActiveSession();

	const leftItems = hasActive ? LIVE_LEFT_ITEMS : NORMAL_LEFT_ITEMS;
	const rightItems = hasActive ? LIVE_RIGHT_ITEMS : NORMAL_RIGHT_ITEMS;

	let activeSessionPath: string | null = null;
	if (activeSession) {
		activeSessionPath =
			activeSession.type === "cash_game"
				? `/live-sessions/cash-game/${activeSession.id}`
				: `/live-sessions/tournament/${activeSession.id}`;
	}

	return (
		<nav className="fixed inset-x-0 bottom-0 z-40 border-sidebar-border border-t bg-sidebar md:hidden">
			<ul className="flex h-16 items-center">
				{leftItems.map((item) => (
					<NavItem
						active={isActive(pathname, item.to)}
						item={item}
						key={item.to}
					/>
				))}

				<CenterButton
					activeSessionPath={activeSessionPath}
					hasActiveSession={hasActive}
				/>

				{rightItems.map((item) => (
					<NavItem
						active={isActive(pathname, item.to)}
						item={item}
						key={item.to}
					/>
				))}
			</ul>
		</nav>
	);
}
