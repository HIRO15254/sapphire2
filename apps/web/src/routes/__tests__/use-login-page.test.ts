import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLoginPage } from "@/routes/-use-login-page";

describe("useLoginPage", () => {
	it("defaults to showing the sign up pane (showSignIn=false)", () => {
		const { result } = renderHook(() => useLoginPage());
		expect(result.current.showSignIn).toBe(false);
	});

	it("exposes onSwitchToSignIn and onSwitchToSignUp handlers", () => {
		const { result } = renderHook(() => useLoginPage());
		expect(typeof result.current.onSwitchToSignIn).toBe("function");
		expect(typeof result.current.onSwitchToSignUp).toBe("function");
	});

	it("onSwitchToSignIn flips showSignIn to true", () => {
		const { result } = renderHook(() => useLoginPage());
		act(() => {
			result.current.onSwitchToSignIn();
		});
		expect(result.current.showSignIn).toBe(true);
	});

	it("onSwitchToSignUp flips showSignIn back to false after being true", () => {
		const { result } = renderHook(() => useLoginPage());
		act(() => {
			result.current.onSwitchToSignIn();
		});
		expect(result.current.showSignIn).toBe(true);
		act(() => {
			result.current.onSwitchToSignUp();
		});
		expect(result.current.showSignIn).toBe(false);
	});

	it("multiple calls to onSwitchToSignIn are idempotent (stays true)", () => {
		const { result } = renderHook(() => useLoginPage());
		act(() => {
			result.current.onSwitchToSignIn();
			result.current.onSwitchToSignIn();
			result.current.onSwitchToSignIn();
		});
		expect(result.current.showSignIn).toBe(true);
	});

	it("multiple calls to onSwitchToSignUp are idempotent (stays false)", () => {
		const { result } = renderHook(() => useLoginPage());
		act(() => {
			result.current.onSwitchToSignUp();
			result.current.onSwitchToSignUp();
		});
		expect(result.current.showSignIn).toBe(false);
	});

	it("alternating switches toggle state deterministically", () => {
		const { result } = renderHook(() => useLoginPage());
		act(() => {
			result.current.onSwitchToSignIn();
		});
		expect(result.current.showSignIn).toBe(true);
		act(() => {
			result.current.onSwitchToSignUp();
		});
		expect(result.current.showSignIn).toBe(false);
		act(() => {
			result.current.onSwitchToSignIn();
		});
		expect(result.current.showSignIn).toBe(true);
	});
});
