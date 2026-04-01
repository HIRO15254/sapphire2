import { Link, useRouterState } from "@tanstack/react-router";
import { isActive, SIDEBAR_ITEMS } from "./mobile-nav";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export function SidebarNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});

	return (
		<nav className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-sidebar-border border-r bg-sidebar md:flex">
			<div className="flex-1 overflow-y-auto px-3 py-4">
				<ul className="flex flex-col gap-1">
					{SIDEBAR_ITEMS.map((item) => {
						const active = isActive(pathname, item.to);
						return (
							<li key={item.to}>
								<Link
									className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
										active
											? "bg-sidebar-accent font-semibold text-sidebar-primary"
											: "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
									}`}
									to={item.to}
								>
									<item.icon size={20} stroke={active ? 2.5 : 1.5} />
									<span>{item.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</div>
			<div className="border-sidebar-border border-t px-3 py-3">
				<div className="flex items-center justify-between">
					<UserMenu />
					<ModeToggle />
				</div>
			</div>
		</nav>
	);
}
