import { useState } from "react";

export function useLoginPage() {
	const [showSignIn, setShowSignIn] = useState(true);

	return {
		showSignIn,
		onSwitchToSignIn: () => setShowSignIn(true),
		onSwitchToSignUp: () => setShowSignIn(false),
	};
}
