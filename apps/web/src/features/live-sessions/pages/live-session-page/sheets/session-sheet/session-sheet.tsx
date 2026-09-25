import { IconInfoCircle } from "@tabler/icons-react";
import type { ChipPurchaseOption } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet";
import {
	currencyRowLabel,
	hasMasterDrift,
	isMasterFieldDifferent,
} from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import {
	CRYST_ALERT,
	CRYST_TAB,
	CRYST_TAB_LIST,
	crystButton,
	onCrystTabListKeyDown,
} from "../../cryst-controls";
import { CrystFormSheet } from "../cryst-form-sheet";
import { CurrencySheet } from "../currency-sheet";
import { DiscardChangesDialog } from "../discard-changes-dialog";
import { GameTypeSheet } from "../game-type-sheet";
import { useDiscardConfirm } from "../use-discard-confirm";
import { SessionBasicsTab } from "./session-basics-tab";
import { SessionBlindsTab } from "./session-blinds-tab";
import { SessionOverviewTab } from "./session-overview-tab";
import { type SessionSheetTab, useSessionSheet } from "./use-session-sheet";

interface SessionSheetProps {
	currentBlindLevelId?: string | null;
	initialTab?: SessionSheetTab;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	purchaseOptions?: readonly ChipPurchaseOption[];
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

const NO_PURCHASE_OPTIONS: ChipPurchaseOption[] = [];
const FORM_ID = "cryst-session-form";

const tabId = (key: string) => `cryst-session-tab-${key}`;
const panelId = (key: string) => `cryst-session-panel-${key}`;

export function SessionSheet({
	currentBlindLevelId = null,
	initialTab = "overview",
	onOpenChange,
	open,
	purchaseOptions = NO_PURCHASE_OPTIONS,
	sessionId,
	sessionType,
}: SessionSheetProps) {
	const sheet = useSessionSheet({
		currentBlindLevelId,
		initialTab,
		onOpenChange,
		open,
		sessionId,
		sessionType,
	});
	const { form } = sheet;
	const discard = useDiscardConfirm({
		isDirty: () => form.state.isDirty,
		onOpenChange,
	});

	return (
		<>
			<CrystFormSheet
				formId={FORM_ID}
				isLoading={sheet.isSaving}
				onOpenChange={discard.onRequestClose}
				open={open}
				title="Session"
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
					<div
						aria-label="Session sections"
						className={CRYST_TAB_LIST}
						onKeyDown={onCrystTabListKeyDown}
						role="tablist"
					>
						{sheet.tabs.map((tab) => (
							<button
								aria-controls={panelId(tab.key)}
								aria-selected={tab.isActive}
								className={CRYST_TAB}
								id={tabId(tab.key)}
								key={tab.key}
								onClick={() => sheet.onSelectTab(tab.key)}
								role="tab"
								tabIndex={tab.isActive ? 0 : -1}
								type="button"
							>
								{tab.label}
							</button>
						))}
					</div>

					<form.Subscribe selector={(state) => state.values}>
						{(values) =>
							hasMasterDrift(sheet.masterValues, values) ? (
								<div
									className={cn(
										CRYST_ALERT,
										"flex items-center gap-2.5 py-1.5 pr-1.5 pl-3.5"
									)}
									role="status"
								>
									<IconInfoCircle className="shrink-0 text-info" size={16} />
									<span className="min-w-0 flex-1 truncate font-semibold tracking-[var(--tracking-heading)]">
										Differs from linked master
									</span>
									<button
										className={crystButton({ size: "sm", variant: "ghost" })}
										onClick={sheet.onResetToMaster}
										type="button"
									>
										Reset
									</button>
									<button
										className={crystButton({ size: "sm", variant: "ghost" })}
										disabled={sheet.isSyncingMaster}
										onClick={() => {
											sheet.onPushToMaster().catch(() => undefined);
										}}
										type="button"
									>
										Update
									</button>
								</div>
							) : null
						}
					</form.Subscribe>

					<form.Field name="currencyId">
						{(currencyField) => {
							const currency = sheet.findCurrency(currencyField.state.value);
							const currencyLabel = currencyRowLabel(currency);
							return (
								<div
									aria-labelledby={tabId(sheet.tab)}
									id={panelId(sheet.tab)}
									role="tabpanel"
								>
									{sheet.tab === "overview" ? (
										<SessionOverviewTab
											availableTags={sheet.availableTags}
											currencyLabel={currencyLabel}
											form={form}
											isMasterLinked={sheet.isMasterLinked}
											master={sheet.master}
											onCreateTag={sheet.onCreateTag}
											onOpenCurrency={sheet.onOpenCurrency}
											roomName={sheet.roomName}
										/>
									) : null}
									{sheet.tab === "basics" ? (
										<SessionBasicsTab
											blindLabels={sheet.blindLabels}
											currencyLabel={currencyLabel}
											currencyUnit={currency?.unit ?? null}
											form={form}
											gameType={sheet.gameType}
											gameTypeError={sheet.gameTypeError}
											isCash={sheet.isCash}
											isCurrencyDifferent={isMasterFieldDifferent(
												sheet.masterValues,
												"currencyId",
												currencyField.state.value
											)}
											isMix={sheet.isMix}
											master={sheet.masterValues}
											mixStakes={sheet.mixStakes}
											onMixAnteTypeChange={sheet.onMixAnteTypeChange}
											onMixStakeChange={sheet.onMixStakeChange}
											onOpenCurrency={sheet.onOpenCurrency}
											onOpenGameType={sheet.onOpenGameType}
											purchaseOptions={purchaseOptions}
											tableSizes={sheet.tableSizes}
										/>
									) : null}
									{sheet.tab === "blinds" ? (
										<SessionBlindsTab
											blindLabels={sheet.blindLabels}
											defaultMinutes={sheet.defaultMinutes}
											onAddBreak={sheet.onAddBlindBreak}
											onAddLevel={sheet.onAddBlindLevel}
											onCellChange={sheet.onBlindCellChange}
											onDefaultMinutesChange={sheet.onDefaultMinutesChange}
											onGameStakeChange={sheet.onLevelGameStakeChange}
											onOpenGames={sheet.onOpenLevelGames}
											onRemoveRow={sheet.onRemoveBlindRow}
											rows={sheet.blinds.rows}
											summary={sheet.blinds.summary}
										/>
									) : null}
								</div>
							);
						}}
					</form.Field>
				</form>
			</CrystFormSheet>
			<CurrencySheet
				currencies={sheet.currencyOptions}
				onOpenChange={sheet.onCurrencyOpenChange}
				onPick={(currencyId) => {
					form.setFieldValue("currencyId", currencyId);
					sheet.onCurrencyOpenChange(false);
				}}
				open={sheet.isCurrencyOpen}
				selectedCurrencyId={form.state.values.currencyId}
			/>
			<GameTypeSheet
				onClear={sheet.gameTypeSheet.onClear}
				onOpenChange={sheet.gameTypeSheet.onOpenChange}
				onPickMix={sheet.gameTypeSheet.onPickMix}
				onPickVariant={sheet.gameTypeSheet.onPickVariant}
				open={sheet.gameTypeSheet.open}
				target={sheet.gameTypeSheet.target}
			/>
			<DiscardChangesDialog
				onConfirmDiscard={discard.onConfirmDiscard}
				onOpenChange={discard.onCancelDiscard}
				open={discard.isConfirmOpen}
			/>
		</>
	);
}
