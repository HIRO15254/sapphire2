import { useEffect, useState } from "react";
import { formatElapsedTime } from "@/utils/format-elapsed-time";

export function useElapsedTime(
	startedAt: Date | string | number | null | undefined,
	intervalMs = 60_000
): string {
	const [text, setText] = useState(() => formatElapsedTime(startedAt));
	useEffect(() => {
		setText(formatElapsedTime(startedAt));
		const id = setInterval(
			() => setText(formatElapsedTime(startedAt)),
			intervalMs
		);
		return () => clearInterval(id);
	}, [startedAt, intervalMs]);
	return text;
}
