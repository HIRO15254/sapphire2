import { IconPlus, IconTags } from "@tabler/icons-react";
import { SessionFilters } from "@/features/sessions/components/session-filters";
import { SessionFormSheet } from "@/features/sessions/components/session-form-sheet";
import { SessionWizard } from "@/features/sessions/components/session-wizard";
import { SessionTagManager } from "@/features/sessions/pages/sessions-page/session-tag-manager";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { SessionList } from "./session-list";
import { useSessionsPage } from "./use-sessions-page";

export function SessionsPage() {
	const {
		sessions,
		availableTags,
		isLoading,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		isCreatePending,
		isCreateOpen,
		isTagManagerOpen,
		filters,
		bbBiMode,
		rooms,
		currencies,
		createGames,
		setFilters,
		setBbBiMode,
		setIsTagManagerOpen,
		setSelectedRoomId,
		handleCreate,
		handleCreateOpenChange,
		createTag,
	} = useSessionsPage();

	return (
		<div className="min-h-full bg-background text-foreground">
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

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<SessionFilters
						currencies={currencies}
						filters={filters}
						onFiltersChange={setFilters}
						rooms={rooms}
					/>
					<div className="flex items-center gap-1.5">
						<Label className="text-xs" htmlFor="bb-bi-switch">
							BB/BI
						</Label>
						<Switch
							checked={bbBiMode}
							id="bb-bi-switch"
							onCheckedChange={setBbBiMode}
						/>
					</div>
				</div>

				<SessionList
					bbBiMode={bbBiMode}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					isLoading={isLoading}
					onCreate={() => handleCreateOpenChange(true)}
					onLoadMore={fetchNextPage}
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
