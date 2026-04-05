import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PageSection } from "@/components/page-section";

export const Route = createFileRoute("/search")({
	component: SearchComponent,
});

function SearchComponent() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<PageHeader
				description="Search across your data will live here."
				heading="Search"
			/>
			<PageSection description="Coming soon." heading="Availability">
				<p className="text-muted-foreground text-sm">
					This page is reserved for app-wide search.
				</p>
			</PageSection>
		</div>
	);
}
