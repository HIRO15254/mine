import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { TOOLS, type Tool, type ToolEnv } from "./tools";

/**
 * A stateless MCP server over Streamable HTTP: every POST carries JSON-RPC
 * and gets a plain JSON reply. Only tools are offered, so no sessions or
 * server-sent events are needed.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = [
	"2025-06-18",
	"2025-03-26",
	"2024-11-05",
];
const LATEST_PROTOCOL_VERSION = "2025-06-18";

/** Mine has a single user, who lives in Japan. */
export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

const INSTRUCTIONS = [
	"Mine is the user's personal dashboard: tasks (with projects, labels and recurrence), time tracking (a timer and entries per project, with hourly rates) and their Google Calendar (events can be listed, added, changed and deleted).",
	"Dates are YYYY-MM-DD and times are in the user's time zone (Asia/Tokyo). Work out relative dates such as 明日 or 来週の月曜 yourself.",
	"A task has three optional dates: startDate (最速実行可能日, the earliest day it can be started), scheduledDate (予定日, the day planned to do it) and deadline (締め切り). Priority 1 is the most urgent; 4 is the default. The label next marks next actions, which show on Today.",
	"Projects are shared by tasks and time tracking. Refer to them by name or by path such as 大学 / 研究; call list_projects when unsure.",
	"For substantial or multi-step work, keep the user's list of Claude threads current with report_thread_status: working when you start, waiting when you need them, done when finished.",
	"Reply to the user in Japanese.",
].join("\n");

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
	id?: JsonRpcId;
	jsonrpc: "2.0";
	method: string;
	params?: Record<string, unknown>;
}

const requestSchema = z.object({
	id: z.union([z.number(), z.string(), z.null()]).optional(),
	jsonrpc: z.literal("2.0"),
	method: z.string(),
	params: z.record(z.string(), z.unknown()).optional(),
});

export const ERROR = {
	invalidParams: -32_602,
	invalidRequest: -32_600,
	methodNotFound: -32_601,
	parseError: -32_700,
} as const;

function rpcError(id: JsonRpcId, code: number, message: string) {
	return { error: { code, message }, id, jsonrpc: "2.0" as const };
}

function rpcResult(id: JsonRpcId, result: unknown) {
	return { id, jsonrpc: "2.0" as const, result };
}

function inputSchema(tool: Tool): Record<string, unknown> {
	const { $schema: _, ...schema } = z.toJSONSchema(tool.input, {
		io: "input",
		unrepresentable: "any",
	}) as Record<string, unknown>;
	return schema;
}

export function listTools() {
	return TOOLS.map((tool) => ({
		annotations: { title: tool.title, ...tool.annotations },
		description: tool.description,
		inputSchema: inputSchema(tool),
		name: tool.name,
		title: tool.title,
	}));
}

function errorText(error: unknown): string {
	if (error instanceof TRPCError) {
		return error.code === "INTERNAL_SERVER_ERROR"
			? "Internal error"
			: error.message;
	}
	if (error instanceof z.ZodError) {
		return z.prettifyError(error);
	}
	return "Internal error";
}

function toolResult(value: unknown, isError = false) {
	return {
		content: [
			{
				text: typeof value === "string" ? value : JSON.stringify(value),
				type: "text",
			},
		],
		isError,
	};
}

async function callTool(
	params: Record<string, unknown> | undefined,
	env: ToolEnv
) {
	const tool = TOOLS.find((item) => item.name === params?.name);
	if (!tool) {
		return null;
	}
	const input = tool.input.safeParse(params?.arguments ?? {});
	if (!input.success) {
		return toolResult(z.prettifyError(input.error), true);
	}
	try {
		return toolResult(await tool.run(input.data, env));
	} catch (error) {
		if (!(error instanceof TRPCError || error instanceof z.ZodError)) {
			console.error(`MCP tool ${tool.name} failed`, error);
		}
		return toolResult(errorText(error), true);
	}
}

/** What the server tells clients about itself beyond its name. */
export interface ServerDetails {
	/** Icons for the connector list (MCP 2025-11-25 `Implementation.icons`). */
	icons?: Array<{ mimeType: string; sizes: string[]; src: string }>;
	websiteUrl?: string;
}

function initialize(
	params: Record<string, unknown> | undefined,
	details: ServerDetails
) {
	const requested = params?.protocolVersion;
	return {
		capabilities: { tools: { listChanged: false } },
		instructions: INSTRUCTIONS,
		protocolVersion:
			typeof requested === "string" &&
			SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
				? requested
				: LATEST_PROTOCOL_VERSION,
		serverInfo: { ...details, name: "mine", title: "Mine", version: "1.0.0" },
	};
}

async function handleRequest(
	request: JsonRpcRequest,
	env: () => ToolEnv,
	details: ServerDetails
) {
	const id = request.id ?? null;
	switch (request.method) {
		case "initialize":
			return rpcResult(id, initialize(request.params, details));
		case "ping":
			return rpcResult(id, {});
		case "tools/list":
			return rpcResult(id, { tools: listTools() });
		case "tools/call": {
			const result = await callTool(request.params, env());
			return result
				? rpcResult(id, result)
				: rpcError(id, ERROR.invalidParams, "Unknown tool");
		}
		default:
			return rpcError(id, ERROR.methodNotFound, "Method not found");
	}
}

function handleMessage(
	message: unknown,
	env: () => ToolEnv,
	details: ServerDetails
) {
	const parsed = requestSchema.safeParse(message);
	if (!parsed.success) {
		return Promise.resolve(
			rpcError(null, ERROR.invalidRequest, "Invalid request")
		);
	}
	// Notifications (no id) get no reply.
	if (parsed.data.id === undefined) {
		return Promise.resolve(null);
	}
	return handleRequest(parsed.data as JsonRpcRequest, env, details);
}

/**
 * Handles one POST body. Returns null when nothing needs a reply (only
 * notifications), which the transport answers with 202 Accepted.
 */
export async function handleMcp(
	body: string,
	env: () => ToolEnv,
	details: ServerDetails = {}
): Promise<unknown> {
	let message: unknown;
	try {
		message = JSON.parse(body);
	} catch {
		return rpcError(null, ERROR.parseError, "Parse error");
	}
	if (Array.isArray(message)) {
		const replies = (
			await Promise.all(
				message.map((item) => handleMessage(item, env, details))
			)
		).filter((reply) => reply !== null);
		return replies.length > 0 ? replies : null;
	}
	return handleMessage(message, env, details);
}
