import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import type { LatestReleaseNotes } from "@/lib/release-notes";

interface ReleaseNotesDialogProps {
	description?: string;
	notes: LatestReleaseNotes;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function ReleaseNotesDialog({
	description = "Latest user-facing updates included in this release.",
	notes,
	onOpenChange,
	open,
}: ReleaseNotesDialogProps) {
	return (
		<ResponsiveDialog
			onOpenChange={onOpenChange}
			open={open}
			title={`What's new in v${notes.version}`}
		>
			<div className="space-y-4">
				<div className="space-y-1">
					<p className="text-muted-foreground text-sm">{description}</p>
					<p className="text-muted-foreground text-xs">
						Released {new Date(notes.releasedAt).toLocaleDateString()}
					</p>
				</div>

				{notes.changes.user.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No user-facing updates were published in this release.
					</p>
				) : (
					<ul className="space-y-3">
						{notes.changes.user.map((item) => (
							<li className="rounded-lg border p-3" key={item.title}>
								<p className="font-medium text-sm">{item.title}</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{item.summary}
								</p>
								{item.additions?.length ? (
									<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
										{item.additions.map((addition) => (
											<li key={addition}>{addition}</li>
										))}
									</ul>
								) : null}
							</li>
						))}
					</ul>
				)}

				<div className="flex justify-end">
					<Button onClick={() => onOpenChange(false)}>Got it</Button>
				</div>
			</div>
		</ResponsiveDialog>
	);
}
