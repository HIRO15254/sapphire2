import Loader from "@/shared/components/loader";
import { ResponsiveScreen } from "@/shared/components/responsive-screen";
import { LoginScreenDesktop } from "./desktop/login-screen-desktop";
import { LoginScreenMobile } from "./mobile/login-screen-mobile";
import { useLoginScreen } from "./use-login-screen";

export function LoginScreen() {
	const { isPending, ...viewProps } = useLoginScreen();

	if (isPending) {
		return <Loader />;
	}

	return (
		<ResponsiveScreen
			desktop={<LoginScreenDesktop {...viewProps} />}
			mobile={<LoginScreenMobile {...viewProps} />}
		/>
	);
}
