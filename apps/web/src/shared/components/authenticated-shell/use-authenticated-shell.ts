import { useMediaQuery } from "@/shared/hooks/use-media-query";

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

export function useAuthenticatedShell() {
	const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
	return { isDesktop };
}
