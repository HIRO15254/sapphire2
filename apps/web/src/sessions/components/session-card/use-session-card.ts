import { useState } from "react";
import type { ShareableSession } from "@/sessions/utils/share-session";
import { shareSession } from "@/sessions/utils/share-session";

export function useSessionCard(session: ShareableSession) {
	const [isSharing, setIsSharing] = useState(false);

	const handleShare = async () => {
		setIsSharing(true);
		try {
			await shareSession(session);
		} finally {
			setIsSharing(false);
		}
	};

	return {
		isSharing,
		onShare: handleShare,
	};
}
