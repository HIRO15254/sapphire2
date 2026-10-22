import { useRouterState } from "@tanstack/react-router";

export function useMobileNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	return { pathname };
}
