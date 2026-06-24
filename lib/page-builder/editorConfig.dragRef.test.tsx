/**
 * T6 — ContactDetails editor preview attaches Puck's dragRef to its root element.
 *
 * The editor `render` for ContactDetails uses the shared `Preview` helper.
 * `Preview` must accept an optional `puck` and attach `ref={puck?.dragRef ?? undefined}`
 * to its root `<section>` so Puck can measure the block on the canvas.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { editorPuckConfig } from "./editorConfig";
import type { ComponentConfig } from "@measured/puck";
import type { ContactDetailsProps } from "./blocks/ContactDetailsBlock";

describe("ContactDetails editor render — dragRef forwarding", () => {
  it("forwards puck.dragRef to the root element so Puck can measure the block", () => {
    let capturedEl: Element | null = null;
    const dragRef = (el: Element | null) => {
      capturedEl = el;
    };

    const contactDetailsConfig = (
      editorPuckConfig.components as unknown as Record<
        string,
        ComponentConfig<ContactDetailsProps>
      >
    )["ContactDetails"];

    const RenderFn = contactDetailsConfig.render as unknown as (
      props: ContactDetailsProps & { puck?: { dragRef?: (el: Element | null) => void } }
    ) => React.ReactElement;

    render(
      <RenderFn
        showEmail
        showPhone
        showAddress
        showSocials
        puck={{ dragRef }}
      />
    );

    expect(capturedEl).not.toBeNull();
  });
});
