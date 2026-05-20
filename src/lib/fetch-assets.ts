/**
 * fetch-assets — typed HTTP client for GET /assets (ADR-009).
 *
 * Thin wrapper over fetch that:
 *   1. Builds the query string from typed params
 *   2. Handles the 400/500 error envelope (ADR-009 §6)
 *   3. Returns a typed AssetsResponse on success
 *
 * Usage with TanStack Query:
 * ```ts
 * useQuery({
 *   queryKey: ['assets', 'agent', 'global'],
 *   queryFn: () => fetchAssets({ kind: 'agent', scope: 'global' }),
 *   enabled: getSidecarBaseUrl() !== null,
 * })
 * ```
 *
 * Story: 6.2 — Agent Library
 */

import type { AssetsResponse } from "@zoeplane/shared-types";
import { getSidecarBaseUrl } from "./sidecar-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchAssetsParams {
  /** Asset kind — maps to assets.kind CHECK enum. */
  kind: "skill" | "agent" | "command" | "team" | "workflow";
  /** Optional scope filter. Omit to get rows across all scopes. */
  scope?: "global" | "project" | "local";
  /** Project UUID — required when scope is 'project' or 'local'. */
  projectId?: string;
  /** Override the sidecar base URL (useful in tests and Storybook). */
  baseUrl?: string;
}

export class SidecarError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = "SidecarError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Fetch assets from the sidecar GET /assets endpoint.
 *
 * @throws SidecarError on 4xx/5xx responses
 * @throws Error when the sidecar base URL is not yet known (port not announced)
 */
export async function fetchAssets(params: FetchAssetsParams): Promise<AssetsResponse> {
  const { kind, scope, projectId, baseUrl: overrideBaseUrl } = params;

  const baseUrl = overrideBaseUrl ?? getSidecarBaseUrl();
  if (baseUrl === null) {
    throw new Error(
      "fetchAssets: sidecar port not yet known — call initSidecarClient() at startup",
    );
  }

  const searchParams = new URLSearchParams({ kind });
  if (scope !== undefined) searchParams.set("scope", scope);
  if (projectId !== undefined) searchParams.set("projectId", projectId);

  const url = `${baseUrl}/assets?${searchParams.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`fetchAssets: network error — ${String(err)}`);
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new SidecarError(`GET /assets returned ${response.status}`, response.status, body);
  }

  return response.json() as Promise<AssetsResponse>;
}
