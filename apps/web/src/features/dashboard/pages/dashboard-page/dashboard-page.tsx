import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function DashboardPage() {
	return (
		<div className="p-4 md:p-6">
			<PageHeader heading="Dashboard" />
			<EmptyState
				description="The dashboard is temporarily unavailable while we focus on other improvements."
				heading="Coming back soon"
			/>
		</div>
	);
}
