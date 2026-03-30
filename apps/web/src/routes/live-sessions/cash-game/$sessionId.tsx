import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/live-sessions/cash-game/$sessionId")({
	component: CashGameSessionLayout,
});

function CashGameSessionLayout() {
	return <Outlet />;
}
