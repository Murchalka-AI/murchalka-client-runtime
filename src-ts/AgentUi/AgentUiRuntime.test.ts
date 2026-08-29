import { describe, expect, it } from "vitest";
import { defaultClientSecurityPolicy } from "../Security/defaultClientSecurityPolicy.js";
import { AgentUiRuntime } from "./AgentUiRuntime.js";

describe("AgentUiRuntime", () => {
  it("validates state, expiration, components, and the authenticated security context atomically", () => {
    const runtime = new AgentUiRuntime(defaultClientSecurityPolicy);
    const snapshot = runtime.activate({
      viewId: "murchalka.agent.chat",
      version: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      stateSchema: { type: "object", additionalProperties: false, required: ["draft"], properties: { draft: { type: "string", maxLength: 128 } } },
      initialState: { draft: "" },
      componentTree: { component: "standard.document", children: [{ component: "standard.form" }] },
      actions: [{ id: "agent.turn" }],
      accessibility: { liveRegion: "polite" },
      localization: { defaultLocale: "en" },
      securityContextRef: "person:test",
    }, "person:test");

    expect(snapshot.document.viewId).toBe("murchalka.agent.chat");
    expect(snapshot.state).toEqual({ draft: "" });
  });

  it("keeps the prior document when a replacement is invalid", () => {
    const runtime = new AgentUiRuntime(defaultClientSecurityPolicy);
    const valid = {
      viewId: "murchalka.agent.chat",
      version: 1,
      expiration: new Date(Date.now() + 60_000).toISOString(),
      stateSchema: { type: "object" },
      componentTree: { component: "standard.layout" },
      actions: [],
      accessibility: { liveRegion: "polite" },
      localization: { defaultLocale: "en" },
      securityContextRef: "person:test",
    };
    runtime.activate(valid);
    expect(() => runtime.activate({ ...valid, expiration: new Date(0).toISOString() })).toThrow(/expired/);
    expect(runtime.snapshot()?.document.version).toBe(1);
  });
});
