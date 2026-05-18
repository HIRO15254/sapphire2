import { DESKTOP_BREAKPOINT } from "@/shared/hooks/use-current-device";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

export function useAuthenticatedShell() {
	const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
	return { isDesktop };
}
