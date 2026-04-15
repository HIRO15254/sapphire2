import type { PlayerFormValues } from "@/players/components/player-form";
import { PlayerForm } from "@/players/components/player-form";
import { Badge } from "@/shared/components/ui/badge";
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
	isTemporary?: boolean;
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
	isTemporary = false,
	isSaving,
	onCreateTag,
	onOpenChange,
	onRemove,
	onSave,
	open,
	player,
}: PlayerDetailSheetProps) {
	const titleNode = (
		<span className="flex items-center gap-2">
			{player?.name ?? "Player"}
			{isTemporary && (
				<Badge
					className="border-orange-200 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400"
					variant="outline"
				>
					一時
				</Badge>
			)}
		</span>
	);

	return (
		<ResponsiveDialog
			fullHeight
			onOpenChange={onOpenChange}
			open={open}
			title={titleNode}
		>
			<PlayerForm
				availableTags={availableTags}
				defaultMemo={player?.memo}
				defaultTags={player?.tags ?? []}
				defaultValues={{ name: player?.name ?? "" }}
				isLoading={isSaving}
				key={player?.id ?? "empty"}
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
