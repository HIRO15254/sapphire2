import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useHomePage } from "./-use-home-page";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	useHomePage();

	return (
		<div className="flex h-[100dvh] items-center justify-center">
			<EmptyState
				className="border-none bg-transparent py-0"
				description="Redirecting..."
				heading="Loading..."
			/>
		</div>
	);
}
