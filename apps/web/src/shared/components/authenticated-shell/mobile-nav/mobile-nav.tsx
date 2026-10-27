import {
	isActive,
	MOBILE_ITEMS,
	MobileNavItem,
	useNavigationPathname,
} from "@/shared/components/app-navigation";

export function MobileNav() {
	const { pathname } = useNavigationPathname();
	return (
		<nav
			aria-label="Primary"
			className="border-border border-t bg-background pt-1 pb-[calc(10px+env(safe-area-inset-bottom))]"
		>
			<ul className="grid grid-cols-5">
				{MOBILE_ITEMS.map((item) => (
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
