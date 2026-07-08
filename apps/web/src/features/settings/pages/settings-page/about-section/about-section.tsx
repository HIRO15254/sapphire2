import { Button } from "@/shared/components/ui/button";
import { useAboutSection } from "./use-about-section";

export function AboutSection() {
	const { version, onViewUpdateNotes } = useAboutSection();

	return (
		<div className="flex items-center justify-between gap-3">
			<div className="space-y-0.5">
				<p className="t-label text-muted-foreground">Version</p>
				<p className="t-body font-medium">{version ?? "Unknown"}</p>
			</div>
			<Button onClick={onViewUpdateNotes} variant="outline">
				View update notes
			</Button>
		</div>
	);
}
