import { useEmptyRow } from "@/features/rooms/hooks/use-empty-row";
import type { NewLevelValues } from "@/features/rooms/utils/blind-level-helpers";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";

interface EmptyRowProps {
	onCreateLevel: (values: NewLevelValues) => void;
}

export function EmptyRow({ onCreateLevel }: EmptyRowProps) {
	const {
		blind1Ref,
		blind2Ref,
		anteRef,
		minutesRef,
		handleBlind1Blur,
		handleBlind2Blur,
		handleAnteBlur,
		handleMinutesBlur,
	} = useEmptyRow({ onCreateLevel });

	return (
		<TableRow className="border-t border-dashed hover:bg-transparent">
			<TableCell className="w-10 p-0 px-0.5 text-center">
				<span className="text-muted-foreground text-xs">+</span>
			</TableCell>
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput onBlur={handleBlind1Blur} ref={blind1Ref} />
			</TableCell>
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput onBlur={handleBlind2Blur} ref={blind2Ref} />
			</TableCell>
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput onBlur={handleAnteBlur} ref={anteRef} />
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput onBlur={handleMinutesBlur} ref={minutesRef} />
			</TableCell>
			<TableCell className="w-8 p-0" />
		</TableRow>
	);
}
