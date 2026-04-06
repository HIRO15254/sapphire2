import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: session } = authClient.useSession();
	const privateData = useQuery(trpc.privateData.queryOptions());
	const welcomeMessage = session?.user.name
		? `Welcome ${session.user.name}`
		: "Welcome";

	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<PageHeader description={welcomeMessage} heading="Dashboard" />
			<PageSection
				description="Connectivity between the signed-in client and the authenticated API."
				heading="API Status"
			>
				<div className="flex items-center gap-2">
					<div
						className={`h-2 w-2 rounded-full ${
							privateData.data ? "bg-green-500" : "bg-red-500"
						}`}
					/>
					<span className="text-muted-foreground text-sm">
						API: {privateData.data?.message ?? "Unavailable"}
					</span>
				</div>
			</PageSection>
		</div>
	);
}
