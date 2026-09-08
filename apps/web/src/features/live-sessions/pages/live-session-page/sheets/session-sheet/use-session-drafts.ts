import { useState } from "react";

export function useSessionDrafts() {
	const [drafts, setDrafts] = useState<Record<string, string>>({});

	return {
		onDraftChange: (name: string, value: string) => {
			setDrafts((prev) => ({ ...prev, [name]: value }));
		},
		takeDraft: (name: string): string | undefined => {
			const draft = drafts[name];
			if (draft !== undefined) {
				setDrafts((prev) => {
					const { [name]: _dropped, ...rest } = prev;
					return rest;
				});
			}
			return draft;
		},
		textOf: (name: string, serverValue: string) => drafts[name] ?? serverValue,
	};
}
