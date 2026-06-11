import type { PlayerFormValues } from "@/features/players/components/player-form";
import { PlayerForm } from "@/features/players/components/player-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

const PLAYER_DETAIL_FORM_ID = "player-detail-form";

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

/**
 * V2 form sheet for editing a seated player. The FormSheet toolbar's check
 * button submits the inner PlayerForm via `formId`; the destructive
 * "Remove from table" action stays in the body below the form.
 */
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
	return (
		<FormSheet
			formId={PLAYER_DETAIL_FORM_ID}
			isLoading={isSaving}
			onOpenChange={onOpenChange}
			open={open}
			title={player?.name ?? "Player"}
		>
			<div className="flex flex-col gap-4">
				{isTemporary ? (
					<Badge
						className="self-start border-orange-200 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400"
						variant="outline"
					>
						Temp
					</Badge>
				) : null}
				<PlayerForm
					availableTags={availableTags}
					defaultMemo={player?.memo}
					defaultTags={player?.tags ?? []}
					defaultValues={{ name: player?.name ?? "" }}
					formId={PLAYER_DETAIL_FORM_ID}
					key={player?.id ?? "empty"}
					onCreateTag={onCreateTag}
					onSubmit={onSave}
				/>
				<Button
					className="border-destructive text-destructive hover:bg-destructive/10"
					onClick={onRemove}
					type="button"
					variant="outline"
				>
					Remove from table
				</Button>
			</div>
		</FormSheet>
	);
}
