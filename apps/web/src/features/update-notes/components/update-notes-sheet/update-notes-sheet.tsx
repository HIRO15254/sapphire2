import { UPDATE_NOTES } from "@/features/update-notes/constants";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Badge } from "@/shared/components/ui/badge";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useUpdateNotesSheet } from "./use-update-notes-sheet";

export function UpdateNotesSheet() {
	const { isOpen, setIsOpen, viewedVersions, onAccordionChange } =
		useUpdateNotesSheet();

	return (
		<Drawer onOpenChange={setIsOpen} open={isOpen}>
			<DrawerContent className="max-h-[85svh] rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<div className="px-4">
					<DrawerTitle className="t-h4">Update notes</DrawerTitle>
					<DrawerDescription className="sr-only">
						Release notes for recent updates.
					</DrawerDescription>
				</div>
				<div className="flex-1 overflow-y-auto px-4 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{UPDATE_NOTES.length === 0 ? (
						<p className="py-4 text-center text-muted-foreground text-sm">
							No update notes available.
						</p>
					) : (
						<Accordion onValueChange={onAccordionChange} type="multiple">
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
										<div className="space-y-3">
											{note.changes.map((group) => (
												<div key={group.section || "general"}>
													{group.section && (
														<p className="t-label mb-1">{group.section}</p>
													)}
													<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
														{group.items.map((item) => (
															<li key={item}>{item}</li>
														))}
													</ul>
												</div>
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
