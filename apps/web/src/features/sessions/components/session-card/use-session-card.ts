import { useState } from "react";
import type { ShareableSession } from "@/features/sessions/utils/share-session";
import { shareSession } from "@/features/sessions/utils/share-session";

export function useSessionCard(session: ShareableSession) {
	const [isSharing, setIsSharing] = useState(false);
	const [expandedValue, setExpandedValue] = useState<string | null>(null);

	const handleShare = async () => {
		setIsSharing(true);
		try {
			await shareSession(session);
		} finally {
			setIsSharing(false);
		}
	};

	return {
		expandedValue,
		isExpanded: expandedValue !== null,
		isSharing,
		onExpandedValueChange: setExpandedValue,
		onShare: handleShare,
	};
}
