import {
	IconBolt,
	IconBuildingStore,
	IconCards,
	IconLayoutDashboard,
	IconList,
	IconPlus,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { type ComponentType, useState } from "react";
import { CreateSessionDialog } from "@/components/live-sessions/create-session-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
import { useStackSheet } from "@/hooks/use-stack-sheet";
import { cn } from "@/lib/utils";

export interface NavigationItem {
	exact?: boolean;
	icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
	label: string;
	to: string;
}

// Sidebar (desktop) items - all items always visible
export const SIDEBAR_ITEMS: readonly NavigationItem[] = [
	{ to: "/sessions", label: "Sessions", icon: IconCards },
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

// Exported for tests
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

function NavItem({ active, item }: { active: boolean; item: NavigationItem }) {
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

function NormalCenterButton({ onClick }: { onClick: () => void }) {
	return (
		<li className="flex-1">
			<button
				className="relative mx-auto flex flex-col items-center"
				onClick={onClick}
				type="button"
			>
				<div className="flex size-12 translate-y-1 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90">
					<IconPlus size={24} stroke={2} />
				</div>
				<span className="relative z-10 mt-0.5 rounded-full bg-primary px-2 py-px font-bold text-[10px] text-primary-foreground">
					New
				</span>
			</button>
		</li>
	);
}

function LiveCenterButton({ onClick }: { onClick: () => void }) {
	return (
		<li className="flex-1">
			<button
				className="relative mx-auto flex flex-col items-center"
				onClick={onClick}
				type="button"
			>
				<div className="flex size-12 translate-y-1 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
					<IconBolt size={24} stroke={2} />
				</div>
				<span className="relative z-10 mt-0.5 rounded-full bg-green-600 px-2 py-px font-bold text-[10px] text-white dark:bg-green-500">
					Stack
				</span>
			</button>
		</li>
	);
}

export function MobileNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const { hasActive } = useActiveSession();
	const stackSheet = useStackSheet();
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	// In live mode, build dynamic nav items
	const liveLeftItems: NavigationItem[] = hasActive
		? [
				{ to: "/active-session/events", label: "Events", icon: IconList },
				{ to: "/players", label: "Players", icon: IconUsers },
			]
		: [];

	const liveRightItems: NavigationItem[] = hasActive
		? [
				{
					to: "/active-session",
					label: "Overview",
					icon: IconLayoutDashboard,
					exact: true,
				},
				{ to: "/settings", label: "Settings", icon: IconSettings },
			]
		: [];

	const leftItems = hasActive ? liveLeftItems : NORMAL_LEFT_ITEMS;
	const rightItems = hasActive ? liveRightItems : NORMAL_RIGHT_ITEMS;

	return (
		<>
			<nav className="fixed inset-x-0 bottom-0 z-40 border-sidebar-border border-t bg-sidebar md:hidden">
				<ul className="flex h-16 items-center">
					{leftItems.map((item) => (
						<NavItem
							active={isActive(pathname, item.to, item.exact)}
							item={item}
							key={item.to}
						/>
					))}

					{hasActive ? (
						<LiveCenterButton onClick={() => stackSheet.open()} />
					) : (
						<NormalCenterButton onClick={() => setIsCreateOpen(true)} />
					)}

					{rightItems.map((item) => (
						<NavItem
							active={isActive(pathname, item.to, item.exact)}
							item={item}
							key={item.to}
						/>
					))}
				</ul>
			</nav>

			{!hasActive && (
				<CreateSessionDialog
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
				/>
			)}
		</>
	);
}
