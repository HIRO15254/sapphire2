import { useEffect, useState } from "react";
import { formatClockElapsed } from "@/utils/format-elapsed-time";

export function useSessionHeader({
	startedAt,
}: {
	startedAt: Date | string | number | null;
}) {
	const [elapsedText, setElapsedText] = useState(() =>
		formatClockElapsed(startedAt)
	);
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	useEffect(() => {
		setElapsedText(formatClockElapsed(startedAt));
		const id = setInterval(
			() => setElapsedText(formatClockElapsed(startedAt)),
			1000
		);
		return () => clearInterval(id);
	}, [startedAt]);

	return {
		elapsedText,
		isMenuOpen,
		onOpenMenu: () => setIsMenuOpen(true),
		setIsMenuOpen,
	};
}
