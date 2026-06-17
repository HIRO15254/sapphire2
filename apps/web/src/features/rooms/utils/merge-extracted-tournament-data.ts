import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";

// AI 抽出結果が「空白」のフィールドは、既にユーザーが入力済みの情報を上書き
// しないように無視する（SA2-77）。文字列は trim 後に空なら空白扱い。
function hasText(value: string | null | undefined): value is string {
	return typeof value === "string" && value.trim() !== "";
}

// 数値の「空白扱い」: undefined / null / 非有限(NaN, Infinity) / 0以下 は無視して
// 既存値を保持する。AI はプロンプト上ゼロ埋めしない約束だが、万一 0 を返しても
// 既存の入力を消さないよう保険として 0 以下も無視する。
function isMeaningfulNumber(value: number | null | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Merge AI-extracted tournament data over the values the user has already
 * entered (`base`). Blank extracted values never overwrite an existing value —
 * only meaningful values are applied. Non-AI fields carried on `base`
 * (bountyAmount / currencyId / memo / tags) are preserved as-is.
 */
export function mergeExtractedTournamentData(
	extracted: ExtractedTournamentData,
	base: TournamentPartialFormValues | undefined
): TournamentPartialFormValues {
	return {
		...base,
		name: hasText(extracted.name) ? extracted.name : (base?.name ?? ""),
		variant: base?.variant ?? "nlh",
		...(isMeaningfulNumber(extracted.buyIn) && { buyIn: extracted.buyIn }),
		...(isMeaningfulNumber(extracted.entryFee) && {
			entryFee: extracted.entryFee,
		}),
		...(isMeaningfulNumber(extracted.startingStack) && {
			startingStack: extracted.startingStack,
		}),
		...(isMeaningfulNumber(extracted.tableSize) && {
			tableSize: extracted.tableSize,
		}),
		...(extracted.chipPurchases?.length && {
			chipPurchases: extracted.chipPurchases,
		}),
	};
}
