import {
	IconArchive,
	IconArchiveOff,
	IconPencil,
	IconPlayCard,
	IconPlus,
	IconStack2,
	IconStack3,
	IconTrash,
} from "@tabler/icons-react";
import { ActionSheet } from "@/shared/components/action-sheet";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { IconButton } from "@/shared/components/ui/icon-button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { GroupForm } from "./group-form";
import {
	CompactRow,
	DetailRow,
	EmptyList,
	ListLoading,
	LoadAlert,
	MasterList,
	MasterSection,
} from "./master-list";
import { MixForm } from "./mix-form";
import { useGamesPage } from "./use-games-page";
import { VariantForm } from "./variant-form";

const FORM_ID = "game-master-form";

export function GamesPage() {
	const {
		activeGroups,
		addLabel,
		counts,
		data,
		dialog,
		form,
		games,
		menu,
		mixesTab,
		onAdd,
		onDialogConfirm,
		onDialogOpenChange,
		onFormOpenChange,
		onGroupSubmit,
		onMenuArchive,
		onMenuDelete,
		onMenuEdit,
		onMenuOpenChange,
		onMenuRestore,
		onMixSubmit,
		onOpen,
		onRetryGroups,
		onRetryMixes,
		onRetryVariants,
		onTabChange,
		onVariantSubmit,
		structures,
		tab,
	} = useGamesPage();

	function renderGames() {
		if (games.isLoading) {
			return <ListLoading />;
		}
		if (games.isVariantsFailed) {
			return (
				<LoadAlert
					isRetrying={games.isRetrying}
					onRetry={onRetryVariants}
					title="Games didn't load"
					variant="destructive"
				/>
			);
		}
		return (
			<>
				{games.groupsFailed ? (
					<LoadAlert
						isRetrying={games.isGroupsRetrying}
						onRetry={onRetryGroups}
						title="Structures didn't load"
						variant="warning"
					/>
				) : null}
				{games.sections.length === 0 ? (
					<EmptyList icon={<IconPlayCard aria-hidden />} title="No games" />
				) : null}
				{games.sections.map((section) => (
					<MasterSection
						aside={section.aside}
						key={section.id}
						title={section.title}
					>
						<MasterList>
							{section.rows.map((row) => (
								<CompactRow
									dimmed={row.archived}
									key={row.id}
									label={row.label}
									meta={row.short}
									onOpen={onOpen("variant", row.id)}
								/>
							))}
						</MasterList>
					</MasterSection>
				))}
			</>
		);
	}

	function renderMixes() {
		if (mixesTab.isLoading) {
			return <ListLoading />;
		}
		if (mixesTab.isFailed) {
			return (
				<LoadAlert
					isRetrying={mixesTab.isRetrying}
					onRetry={onRetryMixes}
					title="Mixes didn't load"
					variant="destructive"
				/>
			);
		}
		return (
			<>
				{mixesTab.active.length > 0 ? (
					<MasterList>
						{mixesTab.active.map((row) => (
							<DetailRow
								count={row.count}
								dimmed={false}
								key={row.id}
								label={row.label}
								mono
								onOpen={onOpen("mix", row.id)}
								summary={row.summary}
							/>
						))}
					</MasterList>
				) : (
					<EmptyList icon={<IconStack2 aria-hidden />} title="No mixes" />
				)}
				{mixesTab.archived.length > 0 ? (
					<MasterSection label="Archived mixes" title="Archived">
						<MasterList>
							{mixesTab.archived.map((row) => (
								<DetailRow
									count={row.count}
									dimmed
									key={row.id}
									label={row.label}
									mono
									onOpen={onOpen("mix", row.id)}
									summary={row.summary}
								/>
							))}
						</MasterList>
					</MasterSection>
				) : null}
			</>
		);
	}

	function renderStructures() {
		if (structures.isLoading) {
			return <ListLoading />;
		}
		if (structures.isFailed) {
			return (
				<LoadAlert
					isRetrying={structures.isRetrying}
					onRetry={onRetryGroups}
					title="Structures didn't load"
					variant="destructive"
				/>
			);
		}
		return (
			<>
				{structures.active.length > 0 ? (
					<MasterList>
						{structures.active.map((row) => (
							<DetailRow
								count={row.count}
								dimmed={false}
								key={row.id}
								label={row.label}
								mono={false}
								onOpen={onOpen("group", row.id)}
								summary={row.summary}
							/>
						))}
					</MasterList>
				) : (
					<EmptyList icon={<IconStack3 aria-hidden />} title="No structures" />
				)}
				{structures.archived.length > 0 ? (
					<MasterSection label="Archived structures" title="Archived">
						<MasterList>
							{structures.archived.map((row) => (
								<DetailRow
									count={row.count}
									dimmed
									key={row.id}
									label={row.label}
									mono={false}
									onOpen={onOpen("group", row.id)}
									summary={row.summary}
								/>
							))}
						</MasterList>
					</MasterSection>
				) : null}
			</>
		);
	}

	function renderForm() {
		if (!form) {
			return null;
		}
		if (form.kind === "variant") {
			return (
				<VariantForm
					formId={FORM_ID}
					groups={activeGroups}
					key={form.key}
					onSubmit={onVariantSubmit}
					variant={form.variant}
					variants={data.variants}
				/>
			);
		}
		if (form.kind === "mix") {
			return (
				<MixForm
					formId={FORM_ID}
					groups={data.groups}
					key={form.key}
					mix={form.mix}
					mixes={data.mixes}
					onSubmit={onMixSubmit}
					variants={data.variants ?? []}
				/>
			);
		}
		return (
			<GroupForm
				formId={FORM_ID}
				group={form.group}
				groups={data.groups}
				key={form.key}
				onSubmit={onGroupSubmit}
			/>
		);
	}

	const menuGroups = menu
		? [
				{
					items: menu.archived
						? [
								{
									disabled: menu.note !== null,
									icon: <IconArchiveOff aria-hidden />,
									label: "Restore",
									onSelect: onMenuRestore,
								},
							]
						: [
								{
									icon: <IconPencil aria-hidden />,
									label: "Edit",
									onSelect: onMenuEdit,
								},
								{
									disabled: menu.note !== null,
									icon: <IconArchive aria-hidden />,
									label: "Archive",
									onSelect: onMenuArchive,
								},
							],
					label: "Actions",
					note: menu.note,
				},
				{
					items: [
						{
							destructive: true,
							icon: <IconTrash aria-hidden />,
							label: "Delete",
							onSelect: onMenuDelete,
						},
					],
					label: "Danger",
				},
			]
		: [];

	return (
		<div className="bg-background text-foreground flex min-h-full flex-col">
			<PageHeader
				actions={
					<IconButton label={addLabel} onClick={onAdd} size="xl" type="button">
						<IconPlus aria-hidden />
					</IconButton>
				}
				back={{ fallbackTo: "/more" }}
				className="pr-0.5"
				heading="Games"
			/>
			<Tabs onValueChange={onTabChange} value={tab}>
				<div className="px-3.5 pt-2.5 pb-0.5">
					<TabsList variant="pill">
						<TabsTrigger count={counts.games} value="games">
							Games
						</TabsTrigger>
						<TabsTrigger count={counts.mixes} value="mixes">
							Mixes
						</TabsTrigger>
						<TabsTrigger count={counts.structures} value="structures">
							Structures
						</TabsTrigger>
					</TabsList>
				</div>
				<main className="px-3.5 pt-3 pb-6 text-[length:var(--m-text-secondary)]">
					<TabsContent className="flex flex-col gap-4" value="games">
						{renderGames()}
					</TabsContent>
					<TabsContent className="flex flex-col gap-4" value="mixes">
						{renderMixes()}
					</TabsContent>
					<TabsContent className="flex flex-col gap-2" value="structures">
						{renderStructures()}
					</TabsContent>
				</main>
			</Tabs>
			<ActionSheet
				groups={menuGroups}
				onOpenChange={onMenuOpenChange}
				open={menu !== null}
				title={menu?.title ?? ""}
			/>
			<ConfirmDialog
				confirmIcon={
					dialog?.mode === "in-use" ? <IconArchive aria-hidden /> : undefined
				}
				confirmLabel={dialog?.confirmLabel ?? "Delete"}
				description={dialog?.description ?? ""}
				destructive={dialog?.mode !== "in-use"}
				isPending={dialog?.isPending ?? false}
				onConfirm={dialog?.canConfirm ? onDialogConfirm : undefined}
				onOpenChange={onDialogOpenChange}
				open={dialog !== null}
				title={dialog?.title ?? ""}
			/>
			<FormSheet
				confirmLabel={form?.confirmLabel ?? "Save"}
				formId={FORM_ID}
				isLoading={form?.isPending ?? false}
				onOpenChange={onFormOpenChange}
				open={form !== null}
				title={form?.title ?? ""}
			>
				{renderForm()}
			</FormSheet>
		</div>
	);
}
