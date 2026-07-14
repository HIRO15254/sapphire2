import { IconBolt } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { buildEditDefaults } from "@/features/sessions/hooks/use-sessions";
import { DeleteSessionDialog } from "@/features/sessions/pages/session-detail-page/delete-session-dialog";
import { SessionActionsDrawer } from "@/features/sessions/pages/session-detail-page/session-actions-drawer";
import { SessionEditForm } from "@/features/sessions/pages/session-detail-page/session-edit-form";
import {
	buildCashRuleRows,
	buildCashStatRows,
	buildSessionMetaRows,
	buildTournamentRuleRows,
	buildTournamentStatRows,
	getSessionGameName,
	isLiveSession,
} from "@/features/sessions/utils/session-display";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { QueryError } from "@/shared/components/query-error";
import { Badge } from "@/shared/components/ui/badge";
import { LiveResultChart } from "./live-result-chart";
import { SessionDetailSkeleton } from "./session-detail-skeleton";
import { SessionPlHero } from "./session-pl-hero";
import { SessionStatList } from "./session-stat-list";
import { SessionTimeline } from "./session-timeline";
import { TopBar } from "./top-bar";
import { useSessionDetailPage } from "./use-session-detail-page";

const EDIT_FORM_ID = "session-edit-form";

interface SessionDetailPageProps {
	sessionId: string;
}

function PageShell({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">{children}</div>
		</div>
	);
}

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
	const {
		session,
		availableTags,
		isLoading,
		isInitialLoadError,
		onRetry,
		isUpdatePending,
		isLiveLinked,
		canReopen,
		rooms,
		currencies,
		editGames,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		setEditRoomId,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
		handleReopen,
		createTag,
	} = useSessionDetailPage(sessionId);

	if (isLoading) {
		return (
			<PageShell>
				<SessionDetailSkeleton />
			</PageShell>
		);
	}

	if (isInitialLoadError) {
		return (
			<PageShell>
				<QueryError
					message="Unable to load session. Please try again."
					onRetry={onRetry}
				/>
			</PageShell>
		);
	}

	if (!session) {
		return (
			<PageShell>
				<TopBar />
				<PageHeader heading="Session not found" />
				<p className="py-16 text-center text-muted-foreground text-sm">
					This session may have been deleted.
				</p>
			</PageShell>
		);
	}

	const isTournament = session.type === "tournament";
	const live = isLiveSession(session);
	const ruleRows = isTournament
		? buildTournamentRuleRows(session)
		: buildCashRuleRows(session);
	const resultRows = isTournament
		? buildTournamentStatRows(session)
		: buildCashStatRows(session);
	const metaRows = buildSessionMetaRows(session);

	return (
		<PageShell>
			<TopBar onOpenActions={() => setIsActionsOpen(true)} />
			<PageHeader
				heading={
					<span className="flex flex-wrap items-center gap-2">
						<span className="min-w-0 truncate">
							{getSessionGameName(session)}
						</span>
						<Badge
							className={
								live ? "bg-success text-success-foreground" : undefined
							}
							variant={live ? "default" : "secondary"}
						>
							{live ? (
								<>
									<IconBolt size={12} />
									Live
								</>
							) : (
								"Manual"
							)}
						</Badge>
					</span>
				}
			/>

			<SessionPlHero
				chart={
					live ? (
						<LiveResultChart
							liveSessionId={session.id}
							sessionType={isTournament ? "tournament" : "cash_game"}
						/>
					) : undefined
				}
				currencyUnit={session.currencyUnit}
				evProfitLoss={session.evProfitLoss}
				profitLoss={session.profitLoss}
			/>

			<SessionStatList rows={ruleRows} title="Rule" />
			<SessionStatList rows={resultRows} title="Result" />
			<SessionStatList rows={metaRows} title="Details" />

			{live ? (
				<SessionTimeline
					liveSessionId={session.id}
					sessionType={isTournament ? "tournament" : "cash_game"}
				/>
			) : null}

			{session.tags.length > 0 ? (
				<div className="mb-4 flex flex-wrap gap-1">
					{session.tags.map((tag) => (
						<Badge key={tag.id} variant="outline">
							{tag.name}
						</Badge>
					))}
				</div>
			) : null}

			{session.memo ? (
				<section
					aria-label="Memo"
					className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground"
				>
					<p className="whitespace-pre-wrap text-muted-foreground text-sm">
						{session.memo}
					</p>
				</section>
			) : null}

			<SessionActionsDrawer
				canReopen={canReopen}
				onDelete={openDeleteFromActions}
				onEdit={openEditFromActions}
				onOpenChange={setIsActionsOpen}
				onReopen={handleReopen}
				open={isActionsOpen}
			/>

			<FormSheet
				formId={EDIT_FORM_ID}
				isLoading={isUpdatePending}
				onOpenChange={(open) => {
					if (!open) {
						setIsEditOpen(false);
					}
				}}
				open={isEditOpen}
				title="Edit session"
			>
				<SessionEditForm
					currencies={currencies}
					defaultValues={buildEditDefaults(session)}
					formId={EDIT_FORM_ID}
					isLiveLinked={isLiveLinked}
					liveSessionId={isLiveLinked ? session.id : undefined}
					onCreateTag={createTag}
					onRoomChange={setEditRoomId}
					onSubmit={handleEdit}
					ringGames={editGames.ringGames}
					rooms={rooms}
					tags={availableTags}
					tournaments={editGames.tournaments}
				/>
			</FormSheet>

			<DeleteSessionDialog
				onConfirm={handleConfirmDelete}
				onOpenChange={setConfirmingDelete}
				open={confirmingDelete}
			/>
		</PageShell>
	);
}
