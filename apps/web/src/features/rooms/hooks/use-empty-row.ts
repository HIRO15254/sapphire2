import { useRef } from "react";
import {
	deriveAutoAnte,
	deriveAutoBlind2,
	type NewLevelValues,
	parseBlindLevelInput,
} from "@/features/rooms/utils/blind-level-helpers";

interface UseEmptyRowOptions {
	onCreateLevel: (values: NewLevelValues) => void;
}

export function useEmptyRow({ onCreateLevel }: UseEmptyRowOptions) {
	const blind1Ref = useRef<HTMLInputElement>(null);
	const blind2Ref = useRef<HTMLInputElement>(null);
	const blind3Ref = useRef<HTMLInputElement>(null);
	const anteRef = useRef<HTMLInputElement>(null);
	const minutesRef = useRef<HTMLInputElement>(null);

	const resetRow = () => {
		for (const ref of [blind1Ref, blind2Ref, blind3Ref, anteRef, minutesRef]) {
			if (ref.current) {
				ref.current.value = "";
			}
		}
	};

	const tryCreate = (relatedTarget: EventTarget | null) => {
		const cells = [
			blind1Ref.current,
			blind2Ref.current,
			blind3Ref.current,
			anteRef.current,
			minutesRef.current,
		].filter((cell): cell is HTMLInputElement => cell !== null);
		if (cells.includes(relatedTarget as HTMLInputElement)) {
			return;
		}
		const blind1Val = blind1Ref.current
			? parseBlindLevelInput(blind1Ref.current)
			: null;
		const blind2Val = blind2Ref.current
			? parseBlindLevelInput(blind2Ref.current)
			: null;
		const blind3Val = blind3Ref.current
			? parseBlindLevelInput(blind3Ref.current)
			: null;
		const anteVal = anteRef.current
			? parseBlindLevelInput(anteRef.current)
			: null;
		const minutesVal = minutesRef.current
			? parseBlindLevelInput(minutesRef.current)
			: null;
		if (
			blind1Val == null ||
			blind2Val === undefined ||
			blind3Val === undefined ||
			anteVal === undefined ||
			minutesVal === undefined
		) {
			return;
		}
		onCreateLevel({
			blind1: blind1Val,
			blind2: blind2Val,
			...(blind3Ref.current ? { blind3: blind3Val } : {}),
			ante: anteVal,
			minutes: minutesVal,
		});
		resetRow();
	};

	const handleBlind1Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseBlindLevelInput(e.target);
		if (parsed != null) {
			if (blind2Ref.current) {
				const autoBlind2 = deriveAutoBlind2(parsed, blind2Ref.current.value);
				if (autoBlind2 != null) {
					blind2Ref.current.value = autoBlind2;
				}
			}
			if (anteRef.current) {
				const autoAnte = deriveAutoAnte(
					blind2Ref.current?.value ?? val,
					anteRef.current.value
				);
				if (autoAnte != null) {
					anteRef.current.value = autoAnte;
				}
			}
		}
		tryCreate(e.relatedTarget);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseBlindLevelInput(e.target);
		if (parsed != null && anteRef.current) {
			const autoAnte = deriveAutoAnte(val, anteRef.current.value);
			if (autoAnte != null) {
				anteRef.current.value = autoAnte;
			}
		}
		tryCreate(e.relatedTarget);
	};

	const handleAnteBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		parseBlindLevelInput(e.target);
		tryCreate(e.relatedTarget);
	};

	const handleBlind3Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		parseBlindLevelInput(e.target);
		tryCreate(e.relatedTarget);
	};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		parseBlindLevelInput(e.target);
		tryCreate(e.relatedTarget);
	};

	return {
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
	};
}
