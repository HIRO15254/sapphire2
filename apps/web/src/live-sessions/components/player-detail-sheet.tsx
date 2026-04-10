import type { PlayerFormValues } from "@/players/components/player-form";
import { PlayerForm } from "@/players/components/player-form";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface PlayerDetailSheetProps {
	availableTags: TagWithColor[];
	isSaving: boolean;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onOpenChange: (open: boolean) => void;
	onRemove: () => void;
	onSave: (values: PlayerFormValues) => void;
	open: boolean;
	player: {
		id: string;
		memo: string | null;
		name: string;
		tags: TagWithColor[];
	} | null;
}

export function PlayerDetailSheet({
	availableTags,
	isSaving,
	onCreateTag,
	onOpenChange,
	onRemove,
	onSave,
	open,
	player,
}: PlayerDetailSheetProps) {
	return (
		<ResponsiveDialog
			fullHeight
			onOpenChange={onOpenChange}
			open={open}
			title={player?.name ?? "Player"}
		>
			<PlayerForm
				key={player?.id ?? "empty"}
				availableTags={availableTags}
				defaultMemo={player?.memo}
				defaultTags={player?.tags ?? []}
				defaultValues={{ name: player?.name ?? "" }}
				isLoading={isSaving}
				leadingActions={
					<Button
						className="border-destructive text-destructive hover:bg-destructive/10"
						onClick={onRemove}
						type="button"
						variant="outline"
					>
						Remove from table
					</Button>
				}
				onCreateTag={onCreateTag}
				onSubmit={onSave}
			/>
		</ResponsiveDialog>
	);
}
