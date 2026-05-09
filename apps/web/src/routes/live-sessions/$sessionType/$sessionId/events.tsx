import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/live-sessions/$sessionType/$sessionId/events"
)({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/sessions/$id",
			params: { id: params.sessionId },
			replace: true,
		});
	},
	component: () => null,
});
