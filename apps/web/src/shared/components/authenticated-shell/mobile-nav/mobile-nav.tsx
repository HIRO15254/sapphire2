import {
	isActive,
	MobileNavItem,
	NAV_ITEMS,
} from "@/shared/components/app-navigation";
import { useMobileNav } from "./use-mobile-nav";

export function MobileNav() {
	const { pathname } = useMobileNav();

	return (
		<nav className="fixed inset-x-0 bottom-0 z-40 border-sidebar-border border-t bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
			<ul className="flex h-16 items-center">
				{NAV_ITEMS.map((item) => (
					<MobileNavItem
						active={isActive(pathname, item.to, item.exact)}
						item={item}
						key={item.to}
					/>
				))}
			</ul>
		</nav>
	);
}
