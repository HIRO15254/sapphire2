import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "@/features/sessions/pages/sessions-page";

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
});
