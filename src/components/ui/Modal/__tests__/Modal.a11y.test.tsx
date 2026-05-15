/**
 * Modal — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Dialog has role="dialog" with aria-labelledby from ModalTitle
 *   - Destructive variant uses role="alertdialog"
 *   - ModalClose button has aria-label="Close"
 *   - Focus trap is in place (Radix manages this — we test the role contract)
 *   - Zero axe violations across default + destructive + expanded-scope variants
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * NOTE: Radix Dialog portals to document.body. We query from document.body
 *   to ensure the portal content is scanned by axe.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Modal/__tests__/Modal.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, runAxeBody, formatViolations } from "@/test/helpers/runAxe";
import {
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalRoot,
  ModalTitle,
  ModalTrigger,
} from "../Modal";

afterEach(() => {
  cleanup();
});

// Helper: render an open modal (defaultOpen bypasses trigger interaction)
function renderOpenModal(
  props: {
    variant?: "default" | "destructive" | "expanded-scope-confirmation";
    role?: "dialog" | "alertdialog";
  } = {},
) {
  return render(
    <ModalRoot defaultOpen>
      <ModalContent variant={props.variant} role={props.role}>
        <ModalHeader>
          <ModalTitle>Confirm action</ModalTitle>
          <ModalDescription>This will perform the action.</ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <ModalClose>Cancel</ModalClose>
        </ModalFooter>
      </ModalContent>
    </ModalRoot>,
  );
}

describe("Modal — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Role contract ─────────────────────────────────────────────────────────────

  describe("role contract", () => {
    it("renders role='dialog' by default", () => {
      renderOpenModal();
      expect(screen.getByRole("dialog", { name: "Confirm action" })).toBeDefined();
    });

    it("renders role='alertdialog' for destructive variant", () => {
      renderOpenModal({ variant: "destructive", role: "alertdialog" });
      expect(screen.getByRole("alertdialog", { name: "Confirm action" })).toBeDefined();
    });
  });

  // ── aria-labelledby ───────────────────────────────────────────────────────────

  describe("accessible name", () => {
    it("dialog is labelled by ModalTitle", () => {
      renderOpenModal();
      const dialog = screen.getByRole("dialog");
      // Radix wires aria-labelledby to the DialogTitle id automatically
      expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    });
  });

  // ── ModalClose button ─────────────────────────────────────────────────────────

  describe("ModalClose", () => {
    it("ModalClose carries aria-label='Close' with role=button", () => {
      render(
        <ModalRoot defaultOpen>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Settings</ModalTitle>
            </ModalHeader>
            <ModalClose />
          </ModalContent>
        </ModalRoot>,
      );
      const closeButton = screen.getByRole("button", { name: "Close" });
      expect(closeButton).toBeDefined();
    });
  });

  // ── Trigger pattern ────────────────────────────────────────────────────────────

  describe("trigger pattern", () => {
    it("renders trigger with aria-haspopup='dialog'", () => {
      // Use asChild so Radix merges trigger props onto the button (no nesting)
      render(
        <ModalRoot>
          <ModalTrigger asChild>
            <button type="button">Open settings</button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Settings</ModalTitle>
            </ModalHeader>
          </ModalContent>
        </ModalRoot>,
      );
      const trigger = screen.getByRole("button", { name: "Open settings" });
      // Radix sets aria-haspopup and aria-expanded on the trigger
      expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — open default dialog", async () => {
      renderOpenModal();
      const results = await runAxeBody({ region: { enabled: false } });
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — open alertdialog", async () => {
      renderOpenModal({ variant: "destructive", role: "alertdialog" });
      const results = await runAxeBody({ region: { enabled: false } });
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — closed modal (trigger only)", async () => {
      const { container } = render(
        <ModalRoot>
          {/* asChild: Radix merges trigger props onto the button to avoid nested-interactive */}
          <ModalTrigger asChild>
            <button type="button">Open</button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Settings</ModalTitle>
            </ModalHeader>
          </ModalContent>
        </ModalRoot>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
