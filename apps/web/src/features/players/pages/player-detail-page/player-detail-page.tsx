import { ColorBadge } from "@/features/players/components/color-badge";
import { PlayerForm } from "@/features/players/components/player-form";
import { DeletePlayerDialog } from "@/features/players/pages/player-detail-page/delete-player-dialog";
import { PlayerActionsDrawer } from "@/features/players/pages/player-detail-page/player-actions-drawer";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { RichTextContent } from "@/shared/components/ui/rich-text-content";
import { PlayerDetailSkeleton } from "./player-detail-skeleton";
import { TopBar } from "./top-bar";
import { usePlayerDetailPage } from "./use-player-detail-page";

const EDIT_PLAYER_FORM_ID = "player-edit-form";

interface PlayerDetailPageProps {
	playerId: string;
}

export function PlayerDetailPage({ playerId }: PlayerDetailPageProps) {
	const {
		player,
		availableTags,
		createTag,
		isLoading,
		isSaving,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	} = usePlayerDetailPage(playerId);

	if (isLoading) {
		return (
			<div className="min-h-full bg-background text-foreground">
				<div className="p-4">
					<PlayerDetailSkeleton />
				</div>
			</div>
		);
	}

	if (!player) {
		return (
			<div className="min-h-full bg-background text-foreground">
				<div className="p-4">
					<TopBar />
					<PageHeader heading="Player not found" />
					<p className="py-16 text-center text-muted-foreground text-sm">
						This player may have been deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<TopBar onOpenActions={() => setIsActionsOpen(true)} />
				<PageHeader heading={player.name} />

				{player.tags.length > 0 ? (
					<div className="mb-4 flex flex-wrap gap-1">
						{player.tags.map((tag) => (
							<ColorBadge color={tag.color} key={tag.id}>
								{tag.name}
							</ColorBadge>
						))}
					</div>
				) : null}

				<section aria-label="Memo">
					{player.memo ? (
						<RichTextContent html={player.memo} />
					) : (
						<p className="text-muted-foreground text-sm">No memo yet.</p>
					)}
				</section>

				<PlayerActionsDrawer
					onDelete={openDeleteFromActions}
					onEdit={openEditFromActions}
					onOpenChange={setIsActionsOpen}
					open={isActionsOpen}
				/>

				<FormSheet
					formId={EDIT_PLAYER_FORM_ID}
					isLoading={isSaving}
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
					title="Edit player"
				>
					<PlayerForm
						availableTags={availableTags}
						defaultMemo={player.memo}
						defaultTags={player.tags}
						defaultValues={{ name: player.name }}
						formId={EDIT_PLAYER_FORM_ID}
						onCreateTag={createTag}
						onSubmit={handleEdit}
					/>
				</FormSheet>

				<DeletePlayerDialog
					onConfirm={handleConfirmDelete}
					onOpenChange={setConfirmingDelete}
					open={confirmingDelete}
					playerName={player.name}
				/>
			</div>
		</div>
	);
}
