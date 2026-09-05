import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagsInput } from "./tags-input";
import { tagBorderClass } from "@/components/app/tag-pill";

function Controlled(props: Partial<React.ComponentProps<typeof TagsInput>>) {
  const { tags: initialTags, onChange: onChangeProp, ...rest } = props;
  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  return (
    <TagsInput
      removeLabel={(tag) => `Remove ${tag}`}
      {...rest}
      tags={tags}
      onChange={(next) => {
        setTags(next);
        onChangeProp?.(next);
      }}
    />
  );
}

describe("TagsInput", () => {
  it("commits a tag on Enter", () => {
    render(<Controlled tags={[]} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "beach" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("beach")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("commits a tag on comma", () => {
    render(<Controlled tags={[]} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "sunset" } });
    fireEvent.keyDown(input, { key: "," });
    expect(screen.getByText("sunset")).toBeInTheDocument();
  });

  it("commits a tag on space", () => {
    render(<Controlled tags={[]} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "wedding" } });
    fireEvent.keyDown(input, { key: " " });
    expect(screen.getByText("wedding")).toBeInTheDocument();
  });

  it("splits pasted text on commas and whitespace into separate tags", () => {
    render(<Controlled tags={[]} />);
    const input = screen.getByRole("textbox");
    const clipboardData = { getData: () => "a, b c" };
    fireEvent.paste(input, { clipboardData });
    expect(screen.getAllByRole("listitem").map((li) => li.querySelector("span")?.textContent)).toEqual(["a", "b", "c"]);
  });

  it("dedupes: committing an existing tag is a no-op", () => {
    const onChange = vi.fn();
    render(<Controlled tags={["beach"]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "beach" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByText("beach")).toHaveLength(1);
  });

  it("truncates to maxTagLength", () => {
    render(<Controlled tags={[]} maxTagLength={5} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "abcdefgh" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("abcde")).toBeInTheDocument();
  });

  it("stops accepting new tags once maxTags is reached", () => {
    const onChange = vi.fn();
    render(<Controlled tags={["a", "b"]} maxTags={2} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag via its X button and calls onChange without it", () => {
    const onChange = vi.fn();
    render(<Controlled tags={["a", "b"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove a" }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("renders border-border when colorize is false", () => {
    render(<Controlled tags={["beach"]} colorize={false} />);
    const pill = screen.getByText("beach").closest("li")!;
    expect(pill.className).toContain("border-border");
    expect(pill.className).not.toContain(tagBorderClass("beach"));
  });

  it("renders tagBorderClass output when colorize is true", () => {
    render(<Controlled tags={["beach"]} colorize={true} />);
    const pill = screen.getByText("beach").closest("li")!;
    expect(pill.className).toContain(tagBorderClass("beach"));
    expect(pill.className).not.toContain("border-border");
  });
});
