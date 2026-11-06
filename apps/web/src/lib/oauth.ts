export interface AuthorizeRequest {
	clientId: string;
	codeChallenge: string;
	redirectUri: string;
	scope?: string;
	state?: string;
}

/**
 * Reads the OAuth authorize query. Returns an error message (Japanese, for
 * the page) when the request cannot be approved: only the code flow with an
 * S256 PKCE challenge is supported.
 */
export function parseAuthorizeSearch(
	search: Record<string, string>
): AuthorizeRequest | { error: string } {
	const {
		client_id: clientId,
		code_challenge: codeChallenge,
		code_challenge_method: method,
		redirect_uri: redirectUri,
		response_type: responseType,
	} = search;
	if (!(clientId && redirectUri)) {
		return { error: "接続の依頼が正しくありません" };
	}
	if (responseType !== "code" || !codeChallenge || method !== "S256") {
		return { error: "このアプリの接続方式には対応していません" };
	}
	return {
		clientId,
		codeChallenge,
		redirectUri,
		scope: search.scope,
		state: search.state,
	};
}

/** Where to send the user when they decline. */
export function deniedRedirect(redirectUri: string, state?: string): string {
	const url = new URL(redirectUri);
	url.searchParams.set("error", "access_denied");
	if (state) {
		url.searchParams.set("state", state);
	}
	return url.toString();
}

/** A same-origin path to return to after signing in, or null. */
export function safeRedirectPath(value: unknown): string | null {
	return typeof value === "string" &&
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.startsWith("/\\")
		? value
		: null;
}
