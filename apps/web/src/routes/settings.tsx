import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<h1 className="font-bold text-2xl">Settings</h1>
			<p className="mt-2 text-muted-foreground">Coming soon.</p>
		</div>
	);
}
