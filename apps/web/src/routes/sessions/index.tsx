import { IconCards, IconPlus } from "@tabler/icons-react"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { PageHeader } from "@/shared/components/page-header"
import { SessionCard } from "@/sessions/components/session-card"
import {
	SessionFilters,
	type SessionFilterValues,
} from "@/sessions/components/session-filters"
import { SessionForm } from "@/sessions/components/session-form"
import { Button } from "@/shared/components/ui/button"
import { EmptyState } from "@/shared/components/ui/empty-state"
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog"
import { useEntityLists, useStoreGames } from "@/stores/hooks/use-store-games"
import {
	buildEditDefaults,
	type SessionFormValues,
	type SessionItem,
	useSessions,
} from "@/sessions/hooks/use-sessions"

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
})

function SessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingSession, setEditingSession] = useState<SessionItem | null>(null)
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>()
	const [editStoreId, setEditStoreId] = useState<string | undefined>()
	const [filters, setFilters] = useState<SessionFilterValues>({})

	const {
		sessions,
		availableTags,
		isCreatePending,
		isUpdatePending,
		create,
		update,
		delete: deleteSession,
		reopen,
		createTag,
	} = useSessions(filters)

	const { stores, currencies } = useEntityLists()
	const createGames = useStoreGames(selectedStoreId)
	const editGames = useStoreGames(editStoreId)

	const handleCreate = (values: SessionFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false)
		})
	}

	const handleUpdate = (values: SessionFormValues) => {
		if (!editingSession) {
			return
		}
		update({ id: editingSession.id, ...values }).then(() => {
			setEditingSession(null)
		})
	}

	const handleDelete = (id: string) => {
		deleteSession(id)
	}

	const handleReopen = (liveCashGameSessionId: string) => {
		reopen(liveCashGameSessionId)
	}

	return (
		<div className="p-4 md:p-6">
			<PageHeader
				actions={
					<>
						<SessionFilters
							currencies={currencies}
							filters={filters}
							onFiltersChange={setFilters}
							stores={stores}
						/>
						<Button onClick={() => setIsCreateOpen(true)}>
							<IconPlus size={16} />
							New Session
						</Button>
					</>
				}
				heading="Sessions"
			/>

			{sessions.length === 0 ? (
				<EmptyState
					action={
						<Button onClick={() => setIsCreateOpen(true)} variant="outline">
							<IconPlus size={16} />
							New Session
						</Button>
					}
					description="Record your first poker session to start tracking P&L."
					heading="No sessions yet"
					icon={<IconCards size={48} />}
				/>
			) : (
				<div className="flex flex-col gap-2">
					{sessions.map((s) => (
						<SessionCard
							key={s.id}
							onDelete={handleDelete}
							onEdit={(session) => {
								setEditingSession(session)
								setEditStoreId(session.storeId ?? undefined)
							}}
							onReopen={handleReopen}
							session={s}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={(open) => {
					setIsCreateOpen(open)
					if (!open) {
						setSelectedStoreId(undefined)
					}
				}}
				open={isCreateOpen}
				title="New Session"
			>
				<SessionForm
					currencies={currencies}
					isLoading={isCreatePending}
					onCreateTag={createTag}
					onStoreChange={setSelectedStoreId}
					onSubmit={handleCreate}
					ringGames={createGames.ringGames}
					stores={stores}
					tags={availableTags}
					tournaments={createGames.tournaments}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingSession(null)
						setEditStoreId(undefined)
					}
				}}
				open={editingSession !== null}
				title="Edit Session"
			>
				{editingSession && (
					<SessionForm
						currencies={currencies}
						defaultValues={buildEditDefaults(editingSession)}
						isLoading={isUpdatePending}
						onCreateTag={createTag}
						onStoreChange={setEditStoreId}
						onSubmit={handleUpdate}
						ringGames={editGames.ringGames}
						stores={stores}
						tags={availableTags}
						tournaments={editGames.tournaments}
					/>
				)}
			</ResponsiveDialog>
		</div>
	)
}
