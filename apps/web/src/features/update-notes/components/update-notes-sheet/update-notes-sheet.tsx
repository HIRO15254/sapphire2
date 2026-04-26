import { UPDATE_NOTES } from "@/features/update-notes/constants";
import { useUpdateNotesViewed } from "@/features/update-notes/hooks/use-update-notes-viewed";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Badge } from "@/shared/components/ui/badge";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useUpdateNotesSheet } from "./use-update-notes-sheet";

export function UpdateNotesSheet() {
	const { isOpen, setIsOpen } = useUpdateNotesSheet();
	const { viewedVersions, handleAccordionChange } = useUpdateNotesViewed();

	return (
		<ResponsiveDialog
			onOpenChange={setIsOpen}
			open={isOpen}
			title="Update Notes"
		>
			{UPDATE_NOTES.length === 0 ? (
				<p className="py-4 text-center text-muted-foreground text-sm">
					No update notes available.
				</p>
			) : (
				<Accordion onValueChange={handleAccordionChange} type="multiple">
					{UPDATE_NOTES.map((note) => (
						<AccordionItem key={note.version} value={note.version}>
							<AccordionTrigger>
								<div className="flex items-center gap-2">
									<span className="font-semibold">{note.version}</span>
									<span className="text-muted-foreground text-xs">
										{note.releasedAt}
									</span>
									{!viewedVersions.has(note.version) && (
										<Badge variant="default">NEW</Badge>
									)}
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<p className="mb-2 font-medium">{note.title}</p>
								<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
									{note.changes.map((change) => (
										<li key={change}>{change}</li>
									))}
								</ul>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			)}
		</ResponsiveDialog>
	);
}
