import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/shared/components/page-header";

export const Route = createFileRoute("/players/")({
	component: PlayersPage,
});

// Placeholder: the legacy Players UI was removed in SA2-45. The V2 UI is built
// on top of this route in SA2-46. The route itself is kept so navigation links
// (`to="/players"`) stay type-valid against the generated route tree.
function PlayersPage() {
	return (
		<div className="p-4 md:p-6">
			<PageHeader heading="Players" />
		</div>
	);
}
