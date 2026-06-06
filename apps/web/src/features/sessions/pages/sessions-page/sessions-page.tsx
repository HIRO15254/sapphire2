import { IconPlus, IconTags } from "@tabler/icons-react";
import { SessionFilters } from "@/features/sessions/components/session-filters";
import { SessionFormSheet } from "@/features/sessions/components/session-form-sheet";
import { SessionTagManager } from "@/features/sessions/components/session-tag-manager";
import { SessionWizard } from "@/features/sessions/components/session-wizard";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { SessionList } from "./session-list";
import { useSessionsPage } from "./use-sessions-page";

export function SessionsPage() {
	const {
		sessions,
		availableTags,
		isLoading,
		isCreatePending,
		isCreateOpen,
		isTagManagerOpen,
		filters,
		rooms,
		currencies,
		createGames,
		setFilters,
		setIsTagManagerOpen,
		setSelectedRoomId,
		handleCreate,
		handleCreateOpenChange,
		createTag,
	} = useSessionsPage();

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<>
							<Button
								onClick={() => setIsTagManagerOpen(true)}
								size="sm"
								variant="outline"
							>
								<IconTags size={16} />
								Tags
							</Button>
							<Button onClick={() => handleCreateOpenChange(true)} size="sm">
								<IconPlus size={16} />
								New session
							</Button>
						</>
					}
					heading="Sessions"
				/>

				<div className="mb-4">
					<SessionFilters
						currencies={currencies}
						filters={filters}
						onFiltersChange={setFilters}
						rooms={rooms}
					/>
				</div>

				<SessionList
					isLoading={isLoading}
					onCreate={() => handleCreateOpenChange(true)}
					sessions={sessions}
				/>

				<SessionFormSheet
					onOpenChange={handleCreateOpenChange}
					open={isCreateOpen}
					title="New session"
				>
					<SessionWizard
						currencies={currencies}
						isLoading={isCreatePending}
						onCreateTag={createTag}
						onRoomChange={setSelectedRoomId}
						onSubmit={handleCreate}
						ringGames={createGames.ringGames}
						rooms={rooms}
						tags={availableTags}
						tournaments={createGames.tournaments}
					/>
				</SessionFormSheet>

				<SessionFormSheet
					onOpenChange={setIsTagManagerOpen}
					open={isTagManagerOpen}
					title="Manage tags"
				>
					<SessionTagManager />
				</SessionFormSheet>
			</div>
		</div>
	);
}
