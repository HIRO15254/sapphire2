import { useRouterState } from "@tanstack/react-router";
import {
	isActiveItem,
	SIDEBAR_ITEMS,
	SidebarNavItem,
} from "@/shared/components/app-navigation";
import { ModeToggle } from "../mode-toggle";
import UserMenu from "../user-menu";

export function SidebarNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});

	return (
		<nav className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-sidebar-border border-r bg-sidebar md:flex">
			<div className="flex-1 overflow-y-auto px-3 py-4">
				<ul className="flex flex-col gap-1">
					{SIDEBAR_ITEMS.map((item) => {
						const active = isActiveItem(pathname, item);
						return <SidebarNavItem active={active} item={item} key={item.to} />;
					})}
				</ul>
			</div>
			<div className="border-sidebar-border border-t bg-sidebar-accent/20 px-3 py-3">
				<div className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border/60 px-2 py-2">
					<UserMenu />
					<ModeToggle />
				</div>
			</div>
		</nav>
	);
}
