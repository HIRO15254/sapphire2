import { IconPlus } from "@tabler/icons-react";
import { PlayerFormV2 } from "@/features/players/components/player-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { PlayerList } from "./player-list";
import { PlayerSearch } from "./player-search";
import { usePlayersPage } from "./use-players-page";

const CREATE_FORM_ID = "player-create-form";

export function PlayersPage() {
	const {
		players,
		availableTags,
		isLoading,
		isCreateOpen,
		isCreatePending,
		search,
		isSearching,
		setIsCreateOpen,
		setSearch,
		handleCreate,
		createTag,
	} = usePlayersPage();

	return (
		<div className="min-h-full bg-background text-foreground">
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

				<PlayerSearch onChange={setSearch} value={search} />

				<PlayerList
					isLoading={isLoading}
					isSearching={isSearching}
					onCreate={() => setIsCreateOpen(true)}
					players={players}
				/>

				<FormSheet
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
