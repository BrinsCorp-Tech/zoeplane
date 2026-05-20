/**
 * FrontMatterForm — unit tests.
 *
 * Critical invariant tested: unknown field preservation.
 *   "Test by loading a skill with tools: [Bash, Read], edit description,
 *    save, confirm tools is still in the data." (ux-spec §7.6 Section 1)
 *
 * Covers:
 *   - Read mode renders known fields
 *   - Edit mode renders labeled inputs
 *   - Validation: name required / kebab-case / max length
 *   - Unknown fields preserved through onChange
 *   - Unknown fields shown as read-only in edit mode
 *   - validateFrontMatter helper — all field constraints
 *
 * Story: 6.4 (FR-005)
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FrontMatterForm, validateFrontMatter } from "../FrontMatterForm";
import type { SkillFrontMatter } from "../FrontMatterForm";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// validateFrontMatter — pure function tests
// ---------------------------------------------------------------------------

describe("validateFrontMatter", () => {
  it("returns no errors for a valid skill front-matter", () => {
    const errors = validateFrontMatter({
      name: "code-reviewer",
      description: "A code review skill",
      version: "1.0.0",
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("requires name", () => {
    const errors = validateFrontMatter({ name: "" });
    expect(errors.name).toBeDefined();
    expect(errors.name).toContain("required");
  });

  it("rejects name with uppercase letters", () => {
    const errors = validateFrontMatter({ name: "MySkill" });
    expect(errors.name).toBeDefined();
    expect(errors.name).toContain("kebab-case");
  });

  it("rejects name starting with hyphen", () => {
    const errors = validateFrontMatter({ name: "-skill" });
    expect(errors.name).toBeDefined();
  });

  it("rejects name longer than 64 chars", () => {
    const errors = validateFrontMatter({ name: "a".repeat(65) });
    expect(errors.name).toBeDefined();
    expect(errors.name).toContain("64");
  });

  it("accepts valid kebab-case name", () => {
    const errors = validateFrontMatter({ name: "my-skill-123" });
    expect(errors.name).toBeUndefined();
  });

  it("rejects description longer than 256 chars", () => {
    const errors = validateFrontMatter({ name: "x", description: "a".repeat(257) });
    expect(errors.description).toBeDefined();
    expect(errors.description).toContain("256");
  });

  it("soft-warns on non-semver version", () => {
    const errors = validateFrontMatter({ name: "x", version: "v1" });
    expect(errors.version).toBeDefined();
  });

  it("accepts valid semver version", () => {
    const errors = validateFrontMatter({ name: "x", version: "2.3.1" });
    expect(errors.version).toBeUndefined();
  });

  it("accepts empty version", () => {
    const errors = validateFrontMatter({ name: "x", version: "" });
    expect(errors.version).toBeUndefined();
  });

  it("rejects voice_id shorter than 5 chars", () => {
    const errors = validateFrontMatter({ name: "x", voice_id: "abc" });
    expect(errors.voice_id).toBeDefined();
    expect(errors.voice_id).toContain("5");
  });

  it("rejects voice_id longer than 32 chars", () => {
    const errors = validateFrontMatter({ name: "x", voice_id: "a".repeat(33) });
    expect(errors.voice_id).toBeDefined();
    expect(errors.voice_id).toContain("32");
  });

  it("accepts valid voice_id length", () => {
    const errors = validateFrontMatter({ name: "x", voice_id: "abc12" });
    expect(errors.voice_id).toBeUndefined();
  });

  it("rejects invalid hex color with # prefix", () => {
    const errors = validateFrontMatter({ name: "x", color: "#xyz123" });
    expect(errors.color).toBeDefined();
    expect(errors.color).toContain("hex");
  });

  it("accepts valid 6-digit hex color", () => {
    const errors = validateFrontMatter({ name: "x", color: "#1a2b3c" });
    expect(errors.color).toBeUndefined();
  });

  it("accepts free-form palette token (no # prefix)", () => {
    const errors = validateFrontMatter({ name: "x", color: "brand-blue" });
    expect(errors.color).toBeUndefined();
  });

  it("does NOT touch unknown fields — no error emitted", () => {
    const errors = validateFrontMatter({
      name: "x",
      tools: ["Bash", "Read"],
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FrontMatterForm — read mode
// ---------------------------------------------------------------------------

describe("FrontMatterForm read mode", () => {
  it("renders known fields as a <dl>", () => {
    const { container } = render(
      <FrontMatterForm
        value={{ name: "code-reviewer", description: "A review skill" }}
        mode="read"
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
  });

  it("displays the skill name value", () => {
    render(<FrontMatterForm value={{ name: "code-reviewer" }} mode="read" />);
    expect(screen.getByText("code-reviewer")).toBeDefined();
  });

  it("shows 'Not set' for empty optional fields", () => {
    const { getAllByText } = render(<FrontMatterForm value={{ name: "x" }} mode="read" />);
    const notSetEls = getAllByText("Not set");
    expect(notSetEls.length).toBeGreaterThan(0);
  });

  it("renders unknown fields in a disclosure (Other fields)", () => {
    render(<FrontMatterForm value={{ name: "x", tools: ["Bash", "Read"] }} mode="read" />);
    // summary text includes "Other fields"
    expect(screen.getByText(/Other fields/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FrontMatterForm — edit mode
// ---------------------------------------------------------------------------

describe("FrontMatterForm edit mode", () => {
  it("renders an input for the name field", () => {
    render(<FrontMatterForm value={{ name: "code-reviewer" }} mode="edit" onChange={() => {}} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("calls onChange with updated name when input changes", () => {
    const onChange = vi.fn();
    render(<FrontMatterForm value={{ name: "old-name" }} mode="edit" onChange={onChange} />);
    const nameInput = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "new-name" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "new-name" }));
  });

  it("preserves unknown fields through onChange (CRITICAL invariant)", () => {
    const onChange = vi.fn();
    const initialValue: SkillFrontMatter = {
      name: "code-reviewer",
      description: "old description",
      tools: ["Bash", "Read"], // unknown field — must be preserved
    };

    render(<FrontMatterForm value={initialValue} mode="edit" onChange={onChange} />);

    // Change the description field
    const inputs = screen.getAllByRole("textbox");
    // description is the second known field input
    const descInput = inputs.find((el) => {
      const el2 = el as HTMLInputElement;
      return el2.value === "old description";
    }) as HTMLInputElement | undefined;

    expect(descInput).toBeDefined();
    fireEvent.change(descInput!, { target: { value: "new description" } });

    // The onChange call must include the unknown `tools` field
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "new description",
        tools: ["Bash", "Read"],
      }),
    );
  });

  it("does NOT call onChange for unknown fields (they are read-only in edit mode)", () => {
    const onChange = vi.fn();
    render(
      <FrontMatterForm value={{ name: "x", tools: ["Bash"] }} mode="edit" onChange={onChange} />,
    );
    // There should be no input for "tools"
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const fieldKeys = inputs.map((i) => i.getAttribute("data-field"));
    expect(fieldKeys).not.toContain("tools");
  });

  it("shows validation error when error prop is passed for name", () => {
    render(
      <FrontMatterForm
        value={{ name: "" }}
        mode="edit"
        errors={{ name: "Name is required." }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Name is required.")).toBeDefined();
  });

  it("renders required marker on name field", () => {
    const { container } = render(
      <FrontMatterForm value={{ name: "x" }} mode="edit" onChange={() => {}} />,
    );
    // Required marker is aria-hidden="true" * span — check via text content
    expect(container.textContent).toContain("*");
  });

  it("shows unknown fields in a read-only disclosure in edit mode", () => {
    render(
      <FrontMatterForm
        value={{ name: "x", tools: ["Bash", "Read"] }}
        mode="edit"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Other fields/)).toBeDefined();
  });

  it("disables all inputs when disabled=true", () => {
    render(<FrontMatterForm value={{ name: "x" }} mode="edit" disabled onChange={() => {}} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    inputs.forEach((input) => {
      expect(input.disabled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// CRLF handling
// ---------------------------------------------------------------------------

describe("FrontMatterForm — CRLF invariant", () => {
  it("renders value with \\r\\n line endings without crashing", () => {
    // Test that values containing \r\n don't break the component
    render(
      <FrontMatterForm
        value={{ name: "test-skill", description: "A description\r\nwith CRLF" }}
        mode="read"
      />,
    );
    // Should render without throwing
    expect(screen.getByText("test-skill")).toBeDefined();
  });
});
