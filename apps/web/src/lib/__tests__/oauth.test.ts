import { describe, expect, it } from "vitest";

import {
	deniedRedirect,
	parseAuthorizeSearch,
	safeRedirectPath,
} from "../oauth";

const CLAUDE = "https://claude.ai/api/mcp/auth_callback";

describe("parseAuthorizeSearch", () => {
	const valid = {
		client_id: "c1",
		code_challenge: "x".repeat(43),
		code_challenge_method: "S256",
		redirect_uri: CLAUDE,
		response_type: "code",
		scope: "mine",
		state: "s",
	};

	it("reads a code request with an S256 challenge", () => {
		expect(parseAuthorizeSearch(valid)).toEqual({
			clientId: "c1",
			codeChallenge: "x".repeat(43),
			redirectUri: CLAUDE,
			scope: "mine",
			state: "s",
		});
	});

	it("rejects missing fields and other flows", () => {
		expect(parseAuthorizeSearch({})).toHaveProperty("error");
		expect(
			parseAuthorizeSearch({ ...valid, code_challenge_method: "plain" })
		).toHaveProperty("error");
		expect(
			parseAuthorizeSearch({ ...valid, response_type: "token" })
		).toHaveProperty("error");
	});
});

describe("deniedRedirect", () => {
	it("keeps the state", () => {
		expect(deniedRedirect(CLAUDE, "s")).toBe(
			`${CLAUDE}?error=access_denied&state=s`
		);
	});
});

describe("safeRedirectPath", () => {
	it("allows only paths in this app", () => {
		expect(safeRedirectPath("/oauth/authorize?client_id=c")).toBe(
			"/oauth/authorize?client_id=c"
		);
		expect(safeRedirectPath("//evil.example")).toBeNull();
		expect(safeRedirectPath("/\\evil.example")).toBeNull();
		expect(safeRedirectPath("https://evil.example")).toBeNull();
		expect(safeRedirectPath(42)).toBeNull();
	});
});
