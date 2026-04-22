import { useState } from "react";

export function useLoginPage() {
	const [showSignIn, setShowSignIn] = useState(false);

	return {
		showSignIn,
		onSwitchToSignIn: () => setShowSignIn(true),
		onSwitchToSignUp: () => setShowSignIn(false),
	};
}
