import { useRef } from "react";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";

function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

interface UseSortableLevelRowOptions {
	onUpdate: (id: string, updates: Record<string, number | null>) => void;
	row: BlindLevelRow;
}

export function useSortableLevelRow({
	row,
	onUpdate,
}: UseSortableLevelRowOptions) {
	const currentBlind2Ref = useRef(row.blind2 == null ? "" : String(row.blind2));
	const currentAnteRef = useRef(row.ante == null ? "" : String(row.ante));

	const handleBlind1Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		const updates: Record<string, number | null> = { blind1: parsed };
		if (parsed != null) {
			if (!currentBlind2Ref.current) {
				const bb = parsed * 2;
				currentBlind2Ref.current = String(bb);
				updates.blind2 = bb;
				if (!currentAnteRef.current) {
					currentAnteRef.current = String(bb);
					updates.ante = bb;
				}
			} else if (!currentAnteRef.current) {
				currentAnteRef.current = String(parsed);
				updates.ante = parsed;
			}
		}
		onUpdate(row.id, updates);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		currentBlind2Ref.current = val;
		const parsed = parseIntOrNull(val);
		const updates: Record<string, number | null> = { blind2: parsed };
		if (parsed != null && !currentAnteRef.current) {
			currentAnteRef.current = val;
			updates.ante = parsed;
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
