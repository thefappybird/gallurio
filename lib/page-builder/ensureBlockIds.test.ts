import { describe, it, expect } from "vitest";
import { ensureBlockIds } from "./ensureBlockIds";
import type { PuckData, PuckBlockEntry } from "./types";

function block(type: string, props: Record<string, unknown> = {}): PuckBlockEntry {
  return { type, props };
}

describe("ensureBlockIds", () => {
  it("assigns deterministic path ids to id-less blocks and keeps an existing id", () => {
    const data: PuckData = {
      root: {},
      content: [
        block("Heading", { id: "existing-heading", text: "Hi" }),
        block("Container", {
          content: [block("Text", { text: "child a" }), block("Text", { text: "child b" })],
        }),
      ],
    };

    const result = ensureBlockIds(data);

    expect(result.content[0]!.props.id).toBe("existing-heading");
    const container = result.content[1]!;
    expect(container.props.id).toBe("root-1");
    const children = container.props.content as PuckBlockEntry[];
    expect(children[0]!.props.id).toBe("root-1--content-0");
    expect(children[1]!.props.id).toBe("root-1--content-1");
  });

  it("is idempotent — re-running it never changes an already-assigned id", () => {
    const data: PuckData = {
      root: {},
      content: [block("Container", { content: [block("Text", { text: "x" })] })],
    };

    const once = ensureBlockIds(data);
    const twice = ensureBlockIds(once);

    expect(twice).toEqual(once);
  });
});
