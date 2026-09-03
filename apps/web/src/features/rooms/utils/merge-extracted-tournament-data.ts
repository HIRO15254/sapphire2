import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";

function hasText(value: string | null | undefined): value is string {
	return typeof value === "string" && value.trim() !== "";
}

function isMeaningfulNumber(value: number | null | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: number | null | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function mergeExtractedTournamentData(
	extracted: ExtractedTournamentData,
	base: TournamentPartialFormValues | undefined
): TournamentPartialFormValues {
	return {
		...base,
		name: hasText(extracted.name) ? extracted.name : (base?.name ?? ""),
		variant: base?.variant ?? DEFAULT_VARIANT_LABEL,
		...(isMeaningfulNumber(extracted.buyIn) && { buyIn: extracted.buyIn }),
		...(isMeaningfulNumber(extracted.entryFee) && {
			entryFee: extracted.entryFee,
		}),
		...(isPositiveNumber(extracted.startingStack) && {
			startingStack: extracted.startingStack,
		}),
		...(isPositiveNumber(extracted.tableSize) && {
			tableSize: extracted.tableSize,
		}),
		...(extracted.chipPurchases?.length && {
			chipPurchases: extracted.chipPurchases,
		}),
	};
}
