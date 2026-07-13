import { useRef } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	type BlindLevelPatch,
	deriveAutoAnte,
	deriveAutoBlind2,
	parseBlindLevelInput,
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
		const parsed = parseBlindLevelInput(e.target);
		if (parsed === undefined) {
			return;
		}
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
				updates.ante = Number(autoAnte);
			}
		}
		onUpdate(row.id, updates);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseBlindLevelInput(e.target);
		if (parsed === undefined) {
			return;
		}
		currentBlind2Ref.current = val;
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
		const ante = parseBlindLevelInput(e.target);
		if (ante === undefined) {
			return;
		}
		currentAnteRef.current = e.target.value;
		onUpdate(row.id, { ante });
	};

	const handleBlind3Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const blind3 = parseBlindLevelInput(e.target);
		if (blind3 !== undefined) {
			onUpdate(row.id, { blind3 });
		}
	};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		const minutes = parseBlindLevelInput(e.target);
		if (minutes !== undefined) {
			onUpdate(row.id, { minutes });
		}
	};

	return {
		handleBlind1Blur,
		handleBlind2Blur,
		handleBlind3Blur,
		handleAnteBlur,
		handleMinutesBlur,
	};
}
