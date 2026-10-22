import { PageHeader } from "@/shared/components/page-header";

export function HomePage() {
	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader heading="Home" />
			</div>
		</div>
	);
}
