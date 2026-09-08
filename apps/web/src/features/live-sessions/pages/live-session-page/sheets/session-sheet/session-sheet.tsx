import type { ChipPurchaseOption } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet";
import { cn } from "@/lib/utils";
import { CrystSheet } from "../cryst-sheet";
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

export function SessionSheet({
	onOpenChange,
	open,
	purchaseOptions = NO_PURCHASE_OPTIONS,
	sessionId,
	sessionType,
}: SessionSheetProps) {
	const sheet = useSessionSheet({ sessionId, sessionType });

	return (
		<>
			<CrystSheet onOpenChange={onOpenChange} open={open} title="Session">
				<div className="flex flex-col gap-3">
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

					{sheet.tab === "overview" ? (
						<SessionOverviewTab
							currencyLabel={sheet.currencyLabel}
							isMasterLinked={sheet.isMasterLinked}
							master={sheet.master}
							memo={sheet.memoValue}
							onCommitMemo={sheet.onCommitMemo}
							onMemoChange={(value) => sheet.onDraftChange("memo", value)}
							onOpenCurrency={sheet.onOpenCurrency}
							roomName={sheet.roomName}
							tagField={{
								candidates: sheet.tagCandidates,
								isListOpen: sheet.isTagListOpen,
								onAdd: (name) => {
									sheet.onAddTag(name);
								},
								onCloseList: sheet.onCloseTagList,
								onOpenList: sheet.onOpenTagList,
								onQueryChange: sheet.onTagQueryChange,
								onRemove: sheet.onRemoveTag,
								query: sheet.tagQuery,
								tags: sheet.selectedTags,
							}}
						/>
					) : (
						<SessionBasicsTab
							anteType={sheet.anteType}
							blindFields={sheet.blindFields}
							currencyLabel={sheet.currencyLabel}
							currencyUnit={sheet.currencyUnit}
							isCash={sheet.isCash}
							numberFields={sheet.numberFields}
							onChangeField={sheet.onDraftChange}
							onCommitField={sheet.onCommitField}
							onCommitRuleName={sheet.onCommitRuleName}
							onOpenCurrency={sheet.onOpenCurrency}
							onSelectAnteType={sheet.onSelectAnteType}
							onSelectTableSize={sheet.onSelectTableSize}
							purchaseOptions={purchaseOptions}
							ruleName={sheet.ruleNameValue}
							tableSize={sheet.tableSize}
							tableSizes={sheet.tableSizes}
							variantLabel={sheet.variantLabel}
						/>
					)}
				</div>
			</CrystSheet>
			<CurrencySheet
				currencies={sheet.currencyOptions}
				isAddPending={sheet.isCurrencyPending}
				onAdd={sheet.onCreateCurrency}
				onOpenChange={sheet.onCurrencyOpenChange}
				onPick={sheet.onPickCurrency}
				open={sheet.isCurrencyOpen}
				selectedCurrencyId={sheet.selectedCurrencyId}
			/>
		</>
	);
}
