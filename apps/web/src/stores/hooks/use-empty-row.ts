import { useRef } from "react";
import type { NewLevelValues } from "@/stores/utils/blind-level-helpers";

function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

interface UseEmptyRowOptions {
	onCreateLevel: (values: NewLevelValues) => void;
}

export function useEmptyRow({ onCreateLevel }: UseEmptyRowOptions) {
	const blind1Ref = useRef<HTMLInputElement>(null);
	const blind2Ref = useRef<HTMLInputElement>(null);
	const anteRef = useRef<HTMLInputElement>(null);
	const minutesRef = useRef<HTMLInputElement>(null);

	const resetRow = () => {
		for (const ref of [blind1Ref, blind2Ref, anteRef, minutesRef]) {
			if (ref.current) {
				ref.current.value = "";
			}
		}
	};

	const tryCreate = (relatedTarget: EventTarget | null) => {
		const cells = [
			blind1Ref.current,
			blind2Ref.current,
			anteRef.current,
			minutesRef.current,
		];
		if (cells.includes(relatedTarget as HTMLInputElement)) {
			return;
		}
		const blind1Val = parseIntOrNull(blind1Ref.current?.value ?? "");
		if (blind1Val == null) {
			return;
		}
		onCreateLevel({
			blind1: blind1Val,
			blind2: parseIntOrNull(blind2Ref.current?.value ?? ""),
			ante: parseIntOrNull(anteRef.current?.value ?? ""),
			minutes: parseIntOrNull(minutesRef.current?.value ?? ""),
		});
		resetRow();
	};

	const handleBlind1Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		if (parsed != null) {
			if (blind2Ref.current && !blind2Ref.current.value) {
				blind2Ref.current.value = String(parsed * 2);
			}
			if (anteRef.current && !anteRef.current.value) {
				anteRef.current.value = blind2Ref.current?.value ?? val;
			}
		}
		tryCreate(e.relatedTarget);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		if (parsed != null && anteRef.current && !anteRef.current.value) {
			anteRef.current.value = val;
		}
		tryCreate(e.relatedTarget);
	};

	const handleAnteBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		tryCreate(e.relatedTarget);
	};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		tryCreate(e.relatedTarget);
	};

	return {
		blind1Ref,
		blind2Ref,
		anteRef,
		minutesRef,
		handleBlind1Blur,
		handleBlind2Blur,
		handleAnteBlur,
		handleMinutesBlur,
	};
}
