import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary placeholder route. The legacy past-sessions list UI was removed in
 * SA2-51; the v2 list + detail pages are reintroduced by the SA2-52 rework on
 * the same parent branch. Kept here only so the `/sessions/` path stays valid
 * (navigation links, dashboard widget) while the rework lands.
 */
export const Route = createFileRoute("/sessions/")({
	component: () => null,
});
