import { createFileRoute } from "@tanstack/react-router";
import { ApiTester } from "@/features/api-tester/components/api-tester";
import { PageHeader } from "@/shared/components/page-header";

export const Route = createFileRoute("/dev/api-tester")({
	component: ApiTesterPage,
});

function ApiTesterPage() {
	return (
		<div className="flex flex-col gap-4 p-4">
			<PageHeader
				description="Temporary harness for invoking every tRPC procedure. Pick a procedure, edit the JSON input, and run. Used for manual smoke testing during the schema rewrite and design-system migration."
				heading="API tester"
			/>
			<ApiTester />
		</div>
	);
}
