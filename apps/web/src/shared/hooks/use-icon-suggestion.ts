import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import {
	suggestIcon,
	suggestIconForKeywords,
} from "@/shared/lib/tabler-icons/icon-data";
import { trpc } from "@/utils/trpc";

interface UseIconSuggestionOptions {
	getIcon: () => string;
	getName: () => string;
	initialIcon: string;
	setIcon: (name: string) => void;
}

const keywordCache = new Map<string, Promise<string[]>>();

export function useIconSuggestion({
	getIcon,
	getName,
	initialIcon,
	setIcon,
}: UseIconSuggestionOptions) {
	const chosenRef = useRef(initialIcon !== "");
	const autoIconRef = useRef("");
	const requestRef = useRef(0);
	const { mutateAsync: fetchKeywords } = useMutation(
		trpc.aiExtract.suggestIconKeywords.mutationOptions({ retry: false })
	);

	const canSuggest = useCallback(() => {
		if (chosenRef.current) {
			return false;
		}
		const icon = getIcon();
		return icon === "" || icon === autoIconRef.current;
	}, [getIcon]);

	const keywordsFor = useCallback(
		(name: string) => {
			let keywords = keywordCache.get(name);
			if (!keywords) {
				keywords = fetchKeywords({ name }).then(
					(result) => result.keywords,
					() => {
						keywordCache.delete(name);
						return [];
					}
				);
				keywordCache.set(name, keywords);
			}
			return keywords;
		},
		[fetchKeywords]
	);

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
			const trimmed = name.trim();
			const isCurrent = () =>
				request === requestRef.current &&
				getName().trim() === trimmed &&
				canSuggest();

			let suggestion = await suggestIcon(trimmed).catch(() => "");
			if (!suggestion && trimmed && isCurrent()) {
				const keywords = await keywordsFor(trimmed);
				suggestion = await suggestIconForKeywords(keywords).catch(() => "");
			}
			if (!isCurrent()) {
				return;
			}
			if (suggestion !== getIcon()) {
				autoIconRef.current = suggestion;
				setIcon(suggestion);
			}
		},
		[canSuggest, getIcon, getName, keywordsFor, setIcon]
	);

	return { onIconChosen, onNameBlur };
}
