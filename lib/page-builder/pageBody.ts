/**
 * Structural page-body normalization.
 *
 * Navigation and Footer stay as pinned top-level chrome. Every ordinary page
 * block lives inside exactly one locked PageBody slot between them. Keeping
 * this pure makes the same migration usable by the editor, draft preview, and
 * public renderer.
 */
import type { ComponentData, Data } from "@measured/puck";

export const PAGE_BODY_TYPE = "PageBody";
export const PAGE_BODY_ID = "page-body";

type StructuralProps = Record<string, unknown> & {
  id?: string;
  _chrome?: "nav" | "footer";
  content?: ComponentData[];
};

function propsOf(block: ComponentData): StructuralProps {
  return block.props as StructuralProps;
}

function isPageBody(block: ComponentData): boolean {
  return block.type === PAGE_BODY_TYPE;
}

function chromeOf(block: ComponentData): StructuralProps["_chrome"] {
  return propsOf(block)._chrome;
}

function childrenOf(block: ComponentData): ComponentData[] {
  const content = propsOf(block).content;
  return Array.isArray(content) ? content : [];
}

/** Ordinary top-level page content, transparently unwrapping PageBody. */
export function getPageBodyContent(data: Data): ComponentData[] {
  const content = data.content ?? [];
  const body = content.find(isPageBody);
  if (body) return childrenOf(body);
  return content.filter((block) => chromeOf(block) === undefined);
}

/**
 * Produces [Navigation..., PageBody, Footer...] while preserving the first
 * body's id/settings and the encounter order of every ordinary child. Loose
 * blocks and children from duplicate bodies are folded into the survivor.
 * A canonical input returns the same reference.
 */
export function normalizePageBody<T extends Data>(data: T): T {
  const content = data.content ?? [];
  const nav = content.filter((block) => chromeOf(block) === "nav");
  const footers = content.filter((block) => chromeOf(block) === "footer");
  const bodies = content.filter(isPageBody);
  const firstBody = bodies[0];

  const bodyChildren: ComponentData[] = [];
  for (const block of content) {
    if (chromeOf(block)) continue;
    if (isPageBody(block)) bodyChildren.push(...childrenOf(block));
    else bodyChildren.push(block);
  }

  const bodyProps = firstBody ? propsOf(firstBody) : {};
  const body = {
    ...(firstBody ?? { type: PAGE_BODY_TYPE }),
    type: PAGE_BODY_TYPE,
    props: {
      ...bodyProps,
      id:
        typeof bodyProps.id === "string" && bodyProps.id.length > 0
          ? bodyProps.id
          : PAGE_BODY_ID,
      content: bodyChildren,
    },
  } as ComponentData;
  const bodyAlreadyCorrect =
    firstBody !== undefined &&
    bodies.length === 1 &&
    childrenOf(firstBody).length === bodyChildren.length &&
    childrenOf(firstBody).every((child, index) => child === bodyChildren[index]);
  const desired = [...nav, bodyAlreadyCorrect ? firstBody : body, ...footers];
  const orderAlreadyCorrect =
    content.length === desired.length && content.every((block, index) => block === desired[index]);

  if (bodyAlreadyCorrect && orderAlreadyCorrect) return data;
  return { ...data, content: desired } as T;
}
