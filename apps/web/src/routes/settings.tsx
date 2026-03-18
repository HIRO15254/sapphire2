import { createFileRoute } from "@tanstack/react-router";
import { LinkedAccounts } from "@/components/linked-accounts";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<h1 className="font-bold text-2xl">Settings</h1>

			<section className="mt-6">
				<h2 className="mb-3 font-semibold text-lg">Linked Accounts</h2>
				<LinkedAccounts />
			</section>
		</div>
	);
}
