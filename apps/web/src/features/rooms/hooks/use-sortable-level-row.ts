import { useRef } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	type BlindLevelPatch,
	deriveAutoAnte,
	deriveAutoBlind2,
	parseIntOrNull,
} from "@/features/rooms/utils/blind-level-helpers";

interface UseSortableLevelRowOptions {
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	row: BlindLevelRow;
}

export function useSortableLevelRow({
	row,
	onUpdate,
}: UseSortableLevelRowOptions) {
	const currentBlind2Ref = useRef(row.blind2 == null ? "" : String(row.blind2));
	const currentAnteRef = useRef(row.ante == null ? "" : String(row.ante));

	const handleBlind1Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const parsed = parseIntOrNull(e.target.value);
		const updates: BlindLevelPatch = { blind1: parsed };
		if (parsed != null) {
			const autoBlind2 = deriveAutoBlind2(parsed, currentBlind2Ref.current);
			if (autoBlind2 != null) {
				currentBlind2Ref.current = autoBlind2;
				updates.blind2 = parsed * 2;
			}
			// With blind2 already filled, the flat row copies blind1 into a
			// blank ante (historical behavior); otherwise the derived blind2.
			const autoAnte = deriveAutoAnte(
				autoBlind2 ?? String(parsed),
				currentAnteRef.current
			);
			if (autoAnte != null) {
				currentAnteRef.current = autoAnte;
				updates.ante = parseIntOrNull(autoAnte);
			}
		}
		onUpdate(row.id, updates);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		currentBlind2Ref.current = val;
		const parsed = parseIntOrNull(val);
		const updates: BlindLevelPatch = { blind2: parsed };
		if (parsed != null) {
			const autoAnte = deriveAutoAnte(val, currentAnteRef.current);
			if (autoAnte != null) {
				currentAnteRef.current = autoAnte;
				updates.ante = parsed;
			}
		}
		onUpdate(row.id, updates);
	};

	const handleAnteBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		currentAnteRef.current = e.target.value;
		onUpdate(row.id, { ante: parseIntOrNull(e.target.value) });
	};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		onUpdate(row.id, { minutes: parseIntOrNull(e.target.value) });
	};

	return {
		handleBlind1Blur,
		handleBlind2Blur,
		handleAnteBlur,
		handleMinutesBlur,
	};
}
