import { useState } from "react";

export function useLoginPage() {
	const [showSignIn, setShowSignIn] = useState(true);

	return {
		onSwitchToSignIn: () => setShowSignIn(true),
		onSwitchToSignUp: () => setShowSignIn(false),
		showSignIn,
	};
}
