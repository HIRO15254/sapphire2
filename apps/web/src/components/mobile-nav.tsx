import { IconBolt, IconPlus } from "@tabler/icons-react";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
	getMobileNavigationItems,
	isActive,
	MobileNavItem,
	NavigationCenterButton,
} from "@/components/app-navigation";
import { CreateSessionDialog } from "@/components/live-sessions/create-session-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
import { useStackSheet } from "@/hooks/use-stack-sheet";

export function MobileNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const { hasActive } = useActiveSession();
	const stackSheet = useStackSheet();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { leftItems, rightItems } = getMobileNavigationItems(hasActive);
	const centerAction = hasActive
		? {
				icon: IconBolt,
				label: "Stack",
				onClick: () => stackSheet.open(),
				tone: "live" as const,
			}
		: {
				icon: IconPlus,
				label: "New",
				onClick: () => setIsCreateOpen(true),
				tone: "accent" as const,
			};

	return (
		<>
			<nav className="fixed inset-x-0 bottom-0 z-40 border-sidebar-border border-t bg-sidebar md:hidden">
				<ul className="grid h-16 grid-cols-4 items-center">
					{leftItems.map((item) => (
						<MobileNavItem
							active={isActive(pathname, item.to, item.exact)}
							item={item}
							key={item.to}
						/>
					))}

					{rightItems.map((item) => (
						<MobileNavItem
							active={isActive(pathname, item.to, item.exact)}
							item={item}
							key={item.to}
						/>
					))}
				</ul>
				<div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
					<div className="pointer-events-auto">
						<NavigationCenterButton action={centerAction} />
					</div>
				</div>
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
