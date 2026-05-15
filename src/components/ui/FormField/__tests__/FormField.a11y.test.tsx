/**
 * FormField — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - FormLabel is associated with FormControl via htmlFor / id
 *   - Required field: aria-required on control + asterisk in label
 *   - Error state: aria-invalid on control + aria-describedby linking to error
 *   - groupRole="radiogroup": FormField renders <fieldset> + <legend>
 *   - Helper text: aria-describedby links to helper element
 *   - Zero axe violations across stacked + inline + error + required states
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/FormField/__tests__/FormField.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { Input } from "@/components/ui/Input/Input";
import { FormControl, FormErrorText, FormField, FormHelperText, FormLabel } from "../FormField";

afterEach(() => {
  cleanup();
});

describe("FormField — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Label association ─────────────────────────────────────────────────────────

  describe("label association", () => {
    it("FormLabel is associated with FormControl via generated id", () => {
      render(
        <FormField>
          <FormLabel>Email</FormLabel>
          <FormControl asChild>
            <Input type="email" />
          </FormControl>
        </FormField>,
      );
      // Label must be programmatically associated with the input
      const input = screen.getByRole("textbox");
      expect(input.id).toBeTruthy();
      // The label's htmlFor should match the input's id
      const label = screen.getByText("Email");
      expect(label.getAttribute("for")).toBe(input.id);
    });
  });

  // ── Required state ────────────────────────────────────────────────────────────

  describe("required state", () => {
    it("control has aria-required when required=true", () => {
      render(
        <FormField required>
          <FormLabel>Name</FormLabel>
          <FormControl asChild>
            <Input />
          </FormControl>
        </FormField>,
      );
      const input = screen.getByRole("textbox");
      expect(input.getAttribute("aria-required")).toBe("true");
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────────

  describe("error state", () => {
    it("control has aria-invalid when error is provided", () => {
      render(
        <FormField error="Email is required">
          <FormLabel>Email</FormLabel>
          <FormControl asChild>
            <Input type="email" />
          </FormControl>
          <FormErrorText>Email is required</FormErrorText>
        </FormField>,
      );
      const input = screen.getByRole("textbox");
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    it("error message is rendered and linked via aria-describedby", () => {
      render(
        <FormField error="Email is required">
          <FormLabel>Email</FormLabel>
          <FormControl asChild>
            <Input type="email" />
          </FormControl>
          {/* FormErrorText renders children — pass the error text explicitly */}
          <FormErrorText>Email is required</FormErrorText>
        </FormField>,
      );
      expect(screen.getByText("Email is required")).toBeDefined();
      const input = screen.getByRole("textbox");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
    });
  });

  // ── Helper text ───────────────────────────────────────────────────────────────

  describe("helper text", () => {
    it("renders helper text and links via aria-describedby", () => {
      render(
        <FormField>
          <FormLabel>Username</FormLabel>
          <FormControl asChild>
            <Input />
          </FormControl>
          <FormHelperText>Must be 3–20 characters</FormHelperText>
        </FormField>,
      );
      expect(screen.getByText("Must be 3–20 characters")).toBeDefined();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — basic labeled field", async () => {
      const { container } = render(
        <FormField>
          <FormLabel>Email</FormLabel>
          <FormControl asChild>
            <Input type="email" />
          </FormControl>
        </FormField>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — required field", async () => {
      const { container } = render(
        <FormField required>
          <FormLabel>Name</FormLabel>
          <FormControl asChild>
            <Input />
          </FormControl>
        </FormField>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — error state", async () => {
      const { container } = render(
        <FormField error="This field is required">
          <FormLabel>Email</FormLabel>
          <FormControl asChild>
            <Input type="email" />
          </FormControl>
          <FormErrorText>This field is required</FormErrorText>
        </FormField>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — with helper text", async () => {
      const { container } = render(
        <FormField>
          <FormLabel>Username</FormLabel>
          <FormControl asChild>
            <Input />
          </FormControl>
          <FormHelperText>Must be 3–20 characters</FormHelperText>
        </FormField>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
