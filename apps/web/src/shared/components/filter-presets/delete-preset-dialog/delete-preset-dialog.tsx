import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";

export function DeletePresetDialog({
	isPending,
	onCancel,
	onConfirm,
	preset,
}: {
	isPending: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	preset: FilterPresetItem | null;
}) {
	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					onCancel();
				}
			}}
			open={preset !== null}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete preset?</DialogTitle>
					<DialogDescription>
						{preset ? (
							<>
								Are you sure you want to delete the preset &ldquo;{preset.name}
								&rdquo;?
							</>
						) : null}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
