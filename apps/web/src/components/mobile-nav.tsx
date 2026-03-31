import {
	IconBolt,
	IconBuildingStore,
	IconCards,
	IconList,
	IconPlus,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ComponentType, useState } from "react";
import { CreateSessionDialog } from "@/components/live-sessions/create-session-dialog";
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

export function isActive(currentPath: string, itemPath: string): boolean {
	if (itemPath === "/") {
		return currentPath === "/";
	}
	return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
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
	onNewClick,
}: {
	hasActiveSession: boolean;
	activeSessionPath: string | null;
	onNewClick: () => void;
}) {
	const navigate = useNavigate();

	const handleClick = () => {
		if (hasActiveSession && activeSessionPath) {
			navigate({ to: activeSessionPath });
		} else {
			onNewClick();
		}
	};

	return (
		<li className="flex-1">
			<button
				className="relative mx-auto flex flex-col items-center"
				onClick={handleClick}
				type="button"
			>
				<div
					className={cn(
						"flex size-12 translate-y-1 items-center justify-center rounded-full shadow-lg transition-colors",
						hasActiveSession
							? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
							: "bg-primary text-primary-foreground hover:bg-primary/90"
					)}
				>
					{hasActiveSession ? (
						<IconBolt size={24} stroke={2} />
					) : (
						<IconPlus size={24} stroke={2} />
					)}
				</div>
				<span
					className={cn(
						"relative z-10 mt-0.5 rounded-full px-2 py-px font-bold text-[10px]",
						hasActiveSession
							? "bg-green-600 text-white dark:bg-green-500"
							: "bg-primary text-primary-foreground"
					)}
				>
					{hasActiveSession ? "Live" : "New"}
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
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	let activeSessionPath: string | null = null;
	if (hasActive) {
		activeSessionPath = "/active-session";
	}

	// In live mode, build dynamic nav items
	const liveLeftItems: NavigationItem[] = hasActive
		? [
				{ to: "/active-session/events", label: "Events", icon: IconList },
				{ to: "/players", label: "Players", icon: IconUsers },
			]
		: [];

	const liveRightItems: NavigationItem[] = [
		{ to: "/stores", label: "Stores", icon: IconBuildingStore },
		{ to: "/settings", label: "Settings", icon: IconSettings },
	];

	const leftItems = hasActive ? liveLeftItems : NORMAL_LEFT_ITEMS;
	const rightItems = hasActive ? liveRightItems : NORMAL_RIGHT_ITEMS;

	return (
		<>
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
						onNewClick={() => setIsCreateOpen(true)}
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

			{!hasActive && (
				<CreateSessionDialog
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
				/>
			)}
		</>
	);
}
