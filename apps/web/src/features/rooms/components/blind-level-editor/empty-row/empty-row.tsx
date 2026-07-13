import { useEmptyRow } from "@/features/rooms/hooks/use-empty-row";
import type { NewLevelValues } from "@/features/rooms/utils/blind-level-helpers";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import { BlindLevelInput } from "../blind-level-input";

const GENERIC_BLIND_LABELS: BlindSlotLabels = {
	blind1: "Blind 1",
	blind2: "Blind 2",
	blind3: null,
};

interface EmptyRowProps {
	blindLabels?: BlindSlotLabels;
	/** Leading empty Game cell so the row aligns with a hybrid table. */
	gameColumn?: boolean;
	/** Empty third blind cell when a hybrid game-set table exposes that slot. */
	hasBlind3Column?: boolean;
	onCreateLevel: (values: NewLevelValues) => void;
}

export function EmptyRow({
	blindLabels = GENERIC_BLIND_LABELS,
	gameColumn = false,
	hasBlind3Column = false,
	onCreateLevel,
}: EmptyRowProps) {
	const {
		blind1Ref,
		blind2Ref,
		blind3Ref,
		anteRef,
		minutesRef,
		handleBlind1Blur,
		handleBlind2Blur,
		handleBlind3Blur,
		handleAnteBlur,
		handleMinutesBlur,
	} = useEmptyRow({ onCreateLevel });

	return (
		<TableRow className="border-t border-dashed hover:bg-transparent">
			<TableCell className="w-10 p-0 px-0.5 text-center">
				<span className="text-muted-foreground text-xs">+</span>
			</TableCell>
			{gameColumn && <TableCell className="p-0 px-1" />}
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput
					aria-label={`New level ${blindLabels.blind1}`}
					onBlur={handleBlind1Blur}
					ref={blind1Ref}
				/>
			</TableCell>
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput
					aria-label={`New level ${blindLabels.blind2}`}
					onBlur={handleBlind2Blur}
					ref={blind2Ref}
				/>
			</TableCell>
			{hasBlind3Column && (
				<TableCell className="p-0 px-0.5">
					{blindLabels.blind3 === null ? null : (
						<BlindLevelInput
							aria-label={`New level ${blindLabels.blind3}`}
							onBlur={handleBlind3Blur}
							ref={blind3Ref}
						/>
					)}
				</TableCell>
			)}
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput
					aria-label="New level Ante"
					onBlur={handleAnteBlur}
					ref={anteRef}
				/>
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput
					aria-label="New level minutes"
					onBlur={handleMinutesBlur}
					ref={minutesRef}
				/>
			</TableCell>
			<TableCell className="w-8 p-0" />
		</TableRow>
	);
}
