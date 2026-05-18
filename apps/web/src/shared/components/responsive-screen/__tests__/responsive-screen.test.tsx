import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useCurrentDevice: vi.fn(),
}));

vi.mock("@/shared/hooks/use-current-device", () => ({
	useCurrentDevice: mocks.useCurrentDevice,
}));

import { ResponsiveScreen } from "@/shared/components/responsive-screen";

describe("ResponsiveScreen", () => {
	beforeEach(() => {
		mocks.useCurrentDevice.mockReset();
	});

	it("renders the desktop slot when the current device is desktop", () => {
		mocks.useCurrentDevice.mockReturnValue("desktop");
		render(
			<ResponsiveScreen
				desktop={<div>desktop view</div>}
				mobile={<div>mobile view</div>}
			/>
		);
		expect(screen.getByText("desktop view")).toBeInTheDocument();
		expect(screen.queryByText("mobile view")).not.toBeInTheDocument();
	});

	it("renders the mobile slot when the current device is mobile", () => {
		mocks.useCurrentDevice.mockReturnValue("mobile");
		render(
			<ResponsiveScreen
				desktop={<div>desktop view</div>}
				mobile={<div>mobile view</div>}
			/>
		);
		expect(screen.getByText("mobile view")).toBeInTheDocument();
		expect(screen.queryByText("desktop view")).not.toBeInTheDocument();
	});

	it("does not mount the mobile component while on desktop", () => {
		mocks.useCurrentDevice.mockReturnValue("desktop");
		const DesktopOnly = vi.fn(() => <div>desktop only</div>);
		const MobileOnly = vi.fn(() => <div>mobile only</div>);
		render(
			<ResponsiveScreen desktop={<DesktopOnly />} mobile={<MobileOnly />} />
		);
		expect(DesktopOnly).toHaveBeenCalledTimes(1);
		expect(MobileOnly).not.toHaveBeenCalled();
	});

	it("does not mount the desktop component while on mobile", () => {
		mocks.useCurrentDevice.mockReturnValue("mobile");
		const DesktopOnly = vi.fn(() => <div>desktop only</div>);
		const MobileOnly = vi.fn(() => <div>mobile only</div>);
		render(
			<ResponsiveScreen desktop={<DesktopOnly />} mobile={<MobileOnly />} />
		);
		expect(MobileOnly).toHaveBeenCalledTimes(1);
		expect(DesktopOnly).not.toHaveBeenCalled();
	});

	it("swaps slots when the device changes between renders", () => {
		mocks.useCurrentDevice.mockReturnValue("mobile");
		const { rerender } = render(
			<ResponsiveScreen
				desktop={<div>desktop view</div>}
				mobile={<div>mobile view</div>}
			/>
		);
		expect(screen.getByText("mobile view")).toBeInTheDocument();

		mocks.useCurrentDevice.mockReturnValue("desktop");
		rerender(
			<ResponsiveScreen
				desktop={<div>desktop view</div>}
				mobile={<div>mobile view</div>}
			/>
		);
		expect(screen.getByText("desktop view")).toBeInTheDocument();
		expect(screen.queryByText("mobile view")).not.toBeInTheDocument();
	});
});
