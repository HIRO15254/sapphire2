import {
	IconArchive,
	IconArchiveOff,
	IconCategory,
	IconPencil,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import {
	EmptyBlock,
	ListCard,
	ListRow,
	ListSection,
} from "@/features/assets/components/wallet-list";
import type { WalletCategory } from "@/features/assets/hooks/use-wallet-data";
import { ActionSheet } from "@/shared/components/action-sheet";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { LoadErrorState } from "@/shared/components/query-state";
import { TablerIcon } from "@/shared/components/tabler-icon";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Spinner } from "@/shared/components/ui/spinner";
import { CategoryForm } from "./category-form";
import { useCategoriesPage } from "./use-categories-page";

const CATEGORY_FORM_ID = "category-form";

function recordCount(count: number) {
	return `${count} ${count === 1 ? "record" : "records"}`;
}

function CategoryRows({
	categories,
	dimmed,
	onOpen,
}: {
	categories: WalletCategory[];
	dimmed: boolean;
	onOpen: (category: WalletCategory) => () => void;
}) {
	return (
		<ListCard>
			{categories.map((category) => (
				<ListRow
					dimmed={dimmed}
					icon={
						category.icon ? (
							<TablerIcon
								className={dimmed ? undefined : "text-foreground"}
								fallback="category"
								name={category.icon}
							/>
						) : (
							<IconCategory aria-hidden />
						)
					}
					key={category.id}
					meta={recordCount(category.lineCount)}
					onClick={onOpen(category)}
					title={<span className="truncate">{category.name}</span>}
					trailing="dots"
				/>
			))}
		</ListCard>
	);
}

export function CategoriesPage() {
	const {
		active,
		archived,
		deleteTarget,
		formCategory,
		isDeletePending,
		isError,
		isFormOpen,
		isFormPending,
		isLoading,
		isRetrying,
		menuTarget,
		onDelete,
		onDeleteFromMenu,
		onDeleteOpenChange,
		onEditFromMenu,
		onFormOpenChange,
		onMenuOpenChange,
		onNewCategory,
		onOpenCategory,
		onRetry,
		onSubmit,
		onToggleArchive,
	} = useCategoriesPage();

	function renderBody() {
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		if (isLoading) {
			return (
				<div className="text-muted-foreground flex justify-center py-6">
					<Spinner />
				</div>
			);
		}
		if (isError) {
			return (
				<LoadErrorState
					entity="category list"
					isRetrying={isRetrying}
					onRetry={onRetry}
				/>
			);
		}
		return (
			<>
				{active.length > 0 ? (
					<CategoryRows
						categories={active}
						dimmed={false}
						onOpen={onOpenCategory}
					/>
				) : (
					<EmptyBlock
						icon={<IconCategory aria-hidden />}
						title="No categories"
					/>
				)}
				{archived.length > 0 ? (
					<ListSection heading="Archived">
						<CategoryRows
							categories={archived}
							dimmed
							onOpen={onOpenCategory}
						/>
					</ListSection>
				) : null}
			</>
		);
	}

	const isArchived = (menuTarget?.archivedAt ?? null) !== null;
	const isInUse = (menuTarget?.lineCount ?? 0) > 0;

	return (
		<div className="bg-background text-foreground min-h-full">
			<PageHeader
				actions={
					<IconButton
						label="Add category"
						onClick={onNewCategory}
						size="xl"
						type="button"
					>
						<IconPlus aria-hidden />
					</IconButton>
				}
				back={{ fallbackTo: "/assets" }}
				className="pr-0.5"
				heading="Categories"
			/>
			<main className="flex flex-col gap-4 px-3.5 pt-3 pb-6 text-[length:var(--m-text-secondary)]">
				{renderBody()}
			</main>
			<ActionSheet
				groups={[
					{
						items: [
							{
								icon: <IconPencil aria-hidden />,
								label: "Edit",
								onSelect: onEditFromMenu,
							},
							{
								icon: isArchived ? (
									<IconArchiveOff aria-hidden />
								) : (
									<IconArchive aria-hidden />
								),
								label: isArchived ? "Restore" : "Archive",
								onSelect: onToggleArchive,
							},
						],
						label: "Actions",
					},
					{
						items: [
							{
								destructive: true,
								disabled: isInUse,
								icon: <IconTrash aria-hidden />,
								label: "Delete",
								onSelect: onDeleteFromMenu,
							},
						],
						label: "Danger",
						note: isInUse ? "In use." : null,
					},
				]}
				onOpenChange={onMenuOpenChange}
				open={menuTarget !== null}
				title={menuTarget?.name ?? ""}
			/>
			<ConfirmDialog
				description="This can’t be undone."
				isPending={isDeletePending}
				onConfirm={onDelete}
				onOpenChange={onDeleteOpenChange}
				open={deleteTarget !== null}
				title={`Delete ${deleteTarget?.name ?? "category"}?`}
			/>
			<FormSheet
				confirmLabel={formCategory ? "Save" : "Create"}
				formId={CATEGORY_FORM_ID}
				isLoading={isFormPending}
				onOpenChange={onFormOpenChange}
				open={isFormOpen}
				title={formCategory ? "Edit category" : "New category"}
			>
				<CategoryForm
					category={formCategory}
					formId={CATEGORY_FORM_ID}
					onSubmit={onSubmit}
				/>
			</FormSheet>
		</div>
	);
}
