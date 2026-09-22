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
import { useDiscardConfirm } from "../use-discard-confirm";
import { SessionBasicsTab } from "./session-basics-tab";
import { SessionOverviewTab } from "./session-overview-tab";
import { useSessionSheet } from "./use-session-sheet";

interface SessionSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	purchaseOptions?: readonly ChipPurchaseOption[];
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

const NO_PURCHASE_OPTIONS: ChipPurchaseOption[] = [];
const FORM_ID = "cryst-session-form";

export function SessionSheet({
	onOpenChange,
	open,
	purchaseOptions = NO_PURCHASE_OPTIONS,
	sessionId,
	sessionType,
}: SessionSheetProps) {
	const sheet = useSessionSheet({ onOpenChange, open, sessionId, sessionType });
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
								aria-selected={tab.isActive}
								className={CRYST_TAB}
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
							return sheet.tab === "overview" ? (
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
							) : (
								<SessionBasicsTab
									blindLabels={sheet.blindLabels}
									currencyLabel={currencyLabel}
									currencyUnit={currency?.unit ?? null}
									form={form}
									isCash={sheet.isCash}
									isCurrencyDifferent={isMasterFieldDifferent(
										sheet.masterValues,
										"currencyId",
										currencyField.state.value
									)}
									master={sheet.masterValues}
									onOpenCurrency={sheet.onOpenCurrency}
									purchaseOptions={purchaseOptions}
									tableSizes={sheet.tableSizes}
									variantLabel={sheet.variantLabel}
								/>
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
			<DiscardChangesDialog
				onConfirmDiscard={discard.onConfirmDiscard}
				onOpenChange={discard.onCancelDiscard}
				open={discard.isConfirmOpen}
			/>
		</>
	);
}
