import {
	IconCheck,
	IconDatabaseOff,
	IconLink,
	IconListSearch,
	IconLoader2,
	IconPlus,
	IconPokerChip,
	IconTrophy,
	IconUnlink,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import {
	CRYST_BADGE,
	CRYST_BADGE_TONE,
	CRYST_FIELD,
	CRYST_LIST_ROW,
	CRYST_TAB,
	CRYST_TAB_LIST,
	onCrystTabListKeyDown,
} from "../../cryst-controls";
import { CrystEmptyState } from "../../cryst-empty-state";
import { CrystFormSheet } from "../cryst-form-sheet";
import { DiscardChangesDialog } from "../discard-changes-dialog";
import {
	type MasterLinkMode,
	useMasterLinkSheet,
} from "./use-master-link-sheet";

interface MasterLinkSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

const FORM_ID = "cryst-master-link-form";
const PANEL_ID = "cryst-master-link-panel";
const CONTROL_CLASS = `${CRYST_FIELD} box-border h-[var(--m-control)] w-full px-2.5`;
const FOOTNOTE_CLASS = "text-pretty text-[11px] text-muted-foreground";

const MODE_ICONS: Record<MasterLinkMode, typeof IconPlus> = {
	create: IconPlus,
	existing: IconListSearch,
};

const tabId = (mode: MasterLinkMode) => `cryst-master-link-tab-${mode}`;

export function MasterLinkSheet({
	onOpenChange,
	open,
	sessionId,
	sessionType,
}: MasterLinkSheetProps) {
	const sheet = useMasterLinkSheet({
		onOpenChange,
		open,
		sessionId,
		sessionType,
	});
	const { form } = sheet;
	const MasterIcon = sessionType === "tournament" ? IconTrophy : IconPokerChip;

	return (
		<>
			<CrystFormSheet
				confirmLabel={sheet.confirmLabel}
				formId={FORM_ID}
				isLoading={sheet.isBusy}
				isSaveDisabled={sheet.isSaveDisabled}
				onOpenChange={sheet.discard.onRequestClose}
				open={open}
				title={sheet.title}
			>
				<form
					className="flex flex-col gap-3"
					id={FORM_ID}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					{sheet.linked === null ? (
						<div className="flex items-start gap-[7px] rounded-md bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] px-[11px] py-[9px] text-[length:var(--text-xs)] text-warning">
							<IconUnlink className="mt-px shrink-0" size={14} />
							<span className="text-pretty">
								This session keeps its own rule snapshot and is not linked to a{" "}
								{sheet.noun} master. Link one to roll it into that game's stats
								— or save these rules as a new master.
							</span>
						</div>
					) : (
						<div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
							<IconLink className="shrink-0 text-success" size={17} />
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate font-semibold text-[length:var(--m-text-footnote)]">
									{sheet.linked.name}
								</span>
								{sheet.linked.meta === "" ? null : (
									<span className="text-[length:var(--m-text-caption)] text-muted-foreground">
										{sheet.linked.meta}
									</span>
								)}
							</span>
							<button
								className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-transparent px-[9px] text-[length:var(--text-xs)] text-destructive transition-colors hover:bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
								disabled={sheet.isBusy}
								onClick={sheet.onUnlink}
								type="button"
							>
								<IconUnlink size={13} />
								Unlink
							</button>
						</div>
					)}

					<div
						aria-label="Link mode"
						className={CRYST_TAB_LIST}
						onKeyDown={onCrystTabListKeyDown}
						role="tablist"
					>
						{sheet.modes.map((mode) => {
							const ModeIcon = MODE_ICONS[mode.key];
							return (
								<button
									aria-controls={PANEL_ID}
									aria-selected={mode.isActive}
									className={CRYST_TAB}
									id={tabId(mode.key)}
									key={mode.key}
									onClick={() => sheet.onModeChange(mode.key)}
									role="tab"
									tabIndex={mode.isActive ? 0 : -1}
									type="button"
								>
									<ModeIcon aria-hidden size={15} />
									{mode.label}
								</button>
							);
						})}
					</div>

					<div
						aria-labelledby={tabId(sheet.mode)}
						className="flex flex-col gap-3"
						id={PANEL_ID}
						role="tabpanel"
					>
						<label
							className="flex flex-col gap-1.5 font-medium text-[length:var(--text-sm)]"
							htmlFor="cryst-master-link-room"
						>
							Room
							<select
								className={cn(CONTROL_CLASS, "px-2 font-normal")}
								disabled={sheet.rooms.length === 0}
								id="cryst-master-link-room"
								onChange={(e) => sheet.onRoomChange(e.target.value)}
								value={sheet.roomId}
							>
								{sheet.rooms.length === 0 ? (
									<option disabled value="">
										—
									</option>
								) : null}
								{sheet.rooms.map((room) => (
									<option key={room.id} value={room.id}>
										{room.name}
									</option>
								))}
							</select>
						</label>

						{sheet.mode === "existing" ? (
							<>
								<fieldset
									aria-label={`Existing ${sheet.noun} masters`}
									className="m-0 flex max-h-[250px] min-w-0 flex-col overflow-y-auto rounded-md border border-border p-0"
								>
									{sheet.isListLoading ? (
										<div className="flex justify-center py-6">
											<IconLoader2
												aria-label="Loading"
												className="animate-spin text-muted-foreground"
												size={18}
											/>
										</div>
									) : null}
									{!sheet.isListLoading && sheet.options.length === 0 ? (
										<CrystEmptyState
											description={`No ${sheet.noun} in this room — create one instead`}
											icon={IconDatabaseOff}
											size="sm"
										/>
									) : null}
									{sheet.options.map((option) => {
										const isPicked = option.id === sheet.pickedId;
										return (
											<button
												aria-pressed={isPicked}
												className={cn(
													CRYST_LIST_ROW,
													"min-h-14 py-[9px]",
													isPicked && "bg-[var(--selection)]"
												)}
												key={option.id}
												onClick={() => sheet.onPick(option.id)}
												type="button"
											>
												<MasterIcon
													aria-hidden
													className={cn(
														"shrink-0",
														isPicked ? "text-primary" : "text-muted-foreground"
													)}
													size={17}
												/>
												<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
													<span className="truncate font-medium text-[length:var(--m-text-secondary)] leading-[1.3]">
														{option.name}
													</span>
													{option.meta === "" ? null : (
														<span className="font-mono text-[length:var(--m-text-caption)] text-muted-foreground leading-[1.35]">
															{option.meta}
														</span>
													)}
												</span>
												{option.isSameRules ? (
													<span
														className={cn(
															CRYST_BADGE,
															CRYST_BADGE_TONE.success
														)}
													>
														Same rules
													</span>
												) : null}
												{isPicked ? (
													<IconCheck
														aria-hidden
														className="shrink-0 text-primary"
														size={16}
													/>
												) : null}
											</button>
										);
									})}
								</fieldset>
								<p className={FOOTNOTE_CLASS}>
									Linking keeps this session's snapshot as it is. Where they
									differ, the session wins and the difference is shown as a
									badge.
								</p>
							</>
						) : (
							<>
								<form.Field name="name">
									{(field) => (
										<Field
											className="gap-0"
											error={field.state.meta.errors[0]?.message}
											htmlFor="cryst-master-link-name"
											label="Master name"
											required
										>
											<input
												{...NO_INPUT_SUGGESTIONS}
												className={cn(CONTROL_CLASS, "mt-1.5")}
												id="cryst-master-link-name"
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												type="text"
												value={field.state.value}
											/>
										</Field>
									)}
								</form.Field>
								<dl
									aria-label="Rules saved to the new master"
									className="flex flex-col rounded-lg border border-border px-2.5 py-0.5"
								>
									{sheet.snapshotRows.map((row) => (
										<div
											className="flex justify-between gap-3 border-border border-b py-2 text-[length:var(--text-sm)] last:border-b-0"
											key={row.label}
										>
											<dt className="shrink-0 text-muted-foreground">
												{row.label}
											</dt>
											<dd
												className={cn(
													"min-w-0 truncate text-right",
													row.isMono && "font-mono"
												)}
											>
												{row.value}
											</dd>
										</div>
									))}
								</dl>
								<p className={FOOTNOTE_CLASS}>
									The current rule snapshot is saved as a new {sheet.noun}{" "}
									master in this room and linked to the session.
								</p>
							</>
						)}
					</div>
				</form>
			</CrystFormSheet>
			<DiscardChangesDialog
				onConfirmDiscard={sheet.discard.onConfirmDiscard}
				onOpenChange={sheet.discard.onCancelDiscard}
				open={sheet.discard.isConfirmOpen}
			/>
		</>
	);
}
