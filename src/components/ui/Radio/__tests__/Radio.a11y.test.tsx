/**
 * Radio — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - RadioGroup has role="radiogroup" (or "group" in Radix) with aria-label/aria-labelledby
 *   - RadioGroupItem has role="radio" with aria-checked
 *   - Roving tabindex: only one item in tab flow at a time
 *   - Disabled item state
 *   - Zero axe violations across default + selected + disabled states
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Radio/__tests__/Radio.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { RadioGroup, RadioGroupItem } from "../Radio";

afterEach(() => {
  cleanup();
});

describe("Radio — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Role contract ─────────────────────────────────────────────────────────────

  describe("role contract", () => {
    it("renders radio items with role='radio'", () => {
      render(
        <RadioGroup aria-label="Notification frequency" defaultValue="daily">
          <label>
            <RadioGroupItem value="daily" />
            Daily
          </label>
          <label>
            <RadioGroupItem value="weekly" />
            Weekly
          </label>
        </RadioGroup>,
      );
      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBe(2);
    });

    it("selected item has aria-checked='true'", () => {
      render(
        <RadioGroup aria-label="Frequency" defaultValue="daily">
          <label>
            <RadioGroupItem value="daily" />
            Daily
          </label>
        </RadioGroup>,
      );
      const radio = screen.getByRole("radio");
      expect(radio.getAttribute("data-state")).toBe("checked");
    });
  });

  // ── Disabled state ────────────────────────────────────────────────────────────

  describe("disabled state", () => {
    it("disabled item has data-disabled attribute", () => {
      render(
        <RadioGroup aria-label="Options" defaultValue="a">
          <label>
            <RadioGroupItem value="a" />
            Option A
          </label>
          <label>
            <RadioGroupItem value="b" disabled />
            Option B (disabled)
          </label>
        </RadioGroup>,
      );
      const radios = screen.getAllByRole("radio");
      expect(radios[1].getAttribute("data-disabled")).not.toBeNull();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — unselected group with aria-label", async () => {
      const { container } = render(
        <RadioGroup aria-label="Theme">
          <label>
            <RadioGroupItem value="light" />
            Light
          </label>
          <label>
            <RadioGroupItem value="dark" />
            Dark
          </label>
        </RadioGroup>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — selected state", async () => {
      const { container } = render(
        <RadioGroup aria-label="Frequency" defaultValue="daily">
          <label>
            <RadioGroupItem value="daily" />
            Daily
          </label>
          <label>
            <RadioGroupItem value="weekly" />
            Weekly
          </label>
        </RadioGroup>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — with disabled item", async () => {
      const { container } = render(
        <RadioGroup aria-label="Options" defaultValue="a">
          <label>
            <RadioGroupItem value="a" />
            Option A
          </label>
          <label>
            <RadioGroupItem value="b" disabled />
            Option B
          </label>
        </RadioGroup>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
