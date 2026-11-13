import { useCallback, useRef } from "react";
import { suggestIcon } from "@/shared/lib/tabler-icons/icon-data";

interface UseIconSuggestionOptions {
	getIcon: () => string;
	initialIcon: string;
	setIcon: (name: string) => void;
}

export function useIconSuggestion({
	getIcon,
	initialIcon,
	setIcon,
}: UseIconSuggestionOptions) {
	const chosenRef = useRef(initialIcon !== "");
	const autoIconRef = useRef("");
	const requestRef = useRef(0);

	const canSuggest = useCallback(() => {
		if (chosenRef.current) {
			return false;
		}
		const icon = getIcon();
		return icon === "" || icon === autoIconRef.current;
	}, [getIcon]);

	const onIconChosen = useCallback(() => {
		chosenRef.current = true;
		requestRef.current += 1;
	}, []);

	const onNameBlur = useCallback(
		async (name: string) => {
			if (!canSuggest()) {
				return;
			}
			requestRef.current += 1;
			const request = requestRef.current;
			const suggestion = await suggestIcon(name).catch(() => "");
			if (request !== requestRef.current || !canSuggest()) {
				return;
			}
			if (suggestion !== getIcon()) {
				autoIconRef.current = suggestion;
				setIcon(suggestion);
			}
		},
		[canSuggest, getIcon, setIcon]
	);

	return { onIconChosen, onNameBlur };
}
