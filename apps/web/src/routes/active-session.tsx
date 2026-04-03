import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/active-session")({
	component: () => <Outlet />,
});
