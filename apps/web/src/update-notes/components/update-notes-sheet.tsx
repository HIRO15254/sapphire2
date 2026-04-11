import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Badge } from "@/shared/components/ui/badge";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { UPDATE_NOTES } from "@/update-notes/constants";
import { useUpdateNotesSheet } from "@/update-notes/hooks/use-update-notes-sheet";
import { trpc } from "@/utils/trpc";

export function UpdateNotesSheet() {
	const { isOpen, setIsOpen } = useUpdateNotesSheet();
	const queryClient = useQueryClient();
	const [optimisticallyViewed, setOptimisticallyViewed] = useState<Set<string>>(
		new Set()
	);

	const { data: viewedList } = useQuery(
		trpc.updateNoteView.list.queryOptions()
	);

	const serverViewedVersions = new Set(viewedList?.map((v) => v.version));
	const viewedVersions = new Set([
		...serverViewedVersions,
		...optimisticallyViewed,
	]);

	const markViewedMutation = useMutation(
		trpc.updateNoteView.markViewed.mutationOptions({
			onSettled: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.updateNoteView.list.queryOptions().queryKey,
				});
				queryClient.invalidateQueries({
					queryKey:
						trpc.updateNoteView.getLatestViewedVersion.queryOptions().queryKey,
				});
			},
		})
	);

	const handleAccordionChange = (value: string[]) => {
		for (const version of value) {
			if (!viewedVersions.has(version)) {
				setOptimisticallyViewed((prev) => new Set([...prev, version]));
				markViewedMutation.mutate({ version });
			}
		}
	};

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
