import { useRouterState } from "@tanstack/react-router";

export function useNavigationPathname() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	return { pathname };
}
