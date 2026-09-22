import type { ChipPurchaseOption } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet";
import { currencyRowLabel } from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import { CrystFormSheet } from "../cryst-form-sheet";
import { CurrencySheet } from "../currency-sheet";
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

	return (
		<>
			<CrystFormSheet
				formId={FORM_ID}
				isLoading={sheet.isSaving}
				onOpenChange={onOpenChange}
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
						className="flex gap-0.5 rounded-lg bg-muted p-[3px]"
						role="tablist"
					>
						{sheet.tabs.map((tab) => (
							<button
								aria-selected={tab.isActive}
								className={cn(
									"h-[34px] min-w-0 flex-1 rounded-md text-[length:var(--text-sm)]",
									tab.isActive
										? "bg-card font-semibold text-foreground"
										: "bg-transparent font-medium text-muted-foreground"
								)}
								key={tab.key}
								onClick={() => sheet.onSelectTab(tab.key)}
								role="tab"
								type="button"
							>
								{tab.label}
							</button>
						))}
					</div>

					<form.Field name="currencyId">
						{(currencyField) => {
							const currency = sheet.findCurrency(currencyField.state.value);
							const currencyLabel = currencyRowLabel(currency);
							return sheet.tab === "overview" ? (
								<SessionOverviewTab
									currencyLabel={currencyLabel}
									form={form}
									isMasterLinked={sheet.isMasterLinked}
									isTagListOpen={sheet.isTagListOpen}
									master={sheet.master}
									onAddTag={sheet.onAddTag}
									onCloseTagList={sheet.onCloseTagList}
									onOpenCurrency={sheet.onOpenCurrency}
									onOpenTagList={sheet.onOpenTagList}
									onTagQueryChange={sheet.onTagQueryChange}
									roomName={sheet.roomName}
									tagCandidatesFor={sheet.tagCandidatesFor}
									tagQuery={sheet.tagQuery}
									tagsById={sheet.tagsById}
								/>
							) : (
								<SessionBasicsTab
									blindLabels={sheet.blindLabels}
									currencyLabel={currencyLabel}
									currencyUnit={currency?.unit ?? null}
									form={form}
									isCash={sheet.isCash}
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
				isAddPending={sheet.isCurrencyPending}
				onAdd={sheet.onCreateCurrency}
				onOpenChange={sheet.onCurrencyOpenChange}
				onPick={(currencyId) => {
					form.setFieldValue("currencyId", currencyId);
					sheet.onCurrencyOpenChange(false);
				}}
				open={sheet.isCurrencyOpen}
				selectedCurrencyId={form.state.values.currencyId}
			/>
		</>
	);
}
