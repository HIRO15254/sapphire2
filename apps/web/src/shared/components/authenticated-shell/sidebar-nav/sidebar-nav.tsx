import {
	APP_ITEMS,
	isActive,
	LIBRARY_ITEMS,
	NAV_ITEMS,
	SidebarNavItem,
	useNavigationPathname,
} from "@/shared/components/app-navigation";

export function SidebarNav() {
	const { pathname } = useNavigationPathname();
	return (
		<nav
			aria-label="Main"
			className="hidden w-[var(--sidebar-width)] shrink-0 flex-col gap-0.5 overflow-y-auto border-border border-r bg-background p-2.5 md:flex"
		>
			<div className="flex min-h-8 items-center px-1.5 pt-1 pb-2.5 text-sm">
				Sapphire 2
			</div>
			<ul className="flex flex-col gap-0.5">
				{NAV_ITEMS.map((item) => (
					<SidebarNavItem
						active={isActive(pathname, item.to, item.exact)}
						item={item}
						key={item.to}
					/>
				))}
			</ul>
			<div className="px-1.5 pt-3 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-[var(--tracking-caps)]">
				Library
			</div>
			<ul className="flex flex-col gap-0.5">
				{LIBRARY_ITEMS.map((item) => (
					<SidebarNavItem
						active={isActive(pathname, item.to)}
						item={item}
						key={item.to}
					/>
				))}
			</ul>
			<div className="px-1.5 pt-3 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-[var(--tracking-caps)]">
				App
			</div>
			<ul className="flex flex-col gap-0.5">
				{APP_ITEMS.map((item) => (
					<SidebarNavItem
						active={isActive(pathname, item.to)}
						item={item}
						key={item.to}
					/>
				))}
			</ul>
		</nav>
	);
}
