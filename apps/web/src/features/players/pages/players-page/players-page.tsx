import { IconPlus } from "@tabler/icons-react";
import { PlayerFormV2 } from "@/features/players/components/player-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { PlayerFilter } from "./player-filter";
import { PlayerList } from "./player-list";
import { usePlayersPage } from "./use-players-page";

const CREATE_FORM_ID = "player-create-form";

export function PlayersPage() {
	const {
		players,
		availableTags,
		isLoading,
		isCreateOpen,
		isCreatePending,
		filterTagIds,
		setIsCreateOpen,
		toggleFilterTag,
		handleCreate,
		createTag,
	} = usePlayersPage();

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={() => setIsCreateOpen(true)} size="sm">
							<IconPlus size={16} />
							New player
						</Button>
					}
					heading="Players"
				/>

				<PlayerFilter
					availableTags={availableTags}
					onToggle={toggleFilterTag}
					selectedTagIds={filterTagIds}
				/>

				<PlayerList
					isFiltered={filterTagIds.length > 0}
					isLoading={isLoading}
					onCreate={() => setIsCreateOpen(true)}
					players={players}
				/>

				<FormSheet
					contentClassName="theme-v2"
					formId={CREATE_FORM_ID}
					isLoading={isCreatePending}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					title="New player"
				>
					<PlayerFormV2
						availableTags={availableTags}
						formId={CREATE_FORM_ID}
						onCreateTag={createTag}
						onSubmit={handleCreate}
					/>
				</FormSheet>
			</div>
		</div>
	);
}
