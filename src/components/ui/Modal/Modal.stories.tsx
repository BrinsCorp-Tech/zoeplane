import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import {
  ModalRoot,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
} from "./Modal";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta = {
  title: "Foundation/Modal",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button variant="secondary">Edit skill…</Button>
        </ModalTrigger>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Edit skill</ModalTitle>
            <ModalDescription>
              Changes save to ~/.claude/skills/security-review/SKILL.md.
            </ModalDescription>
            <ModalClose />
          </ModalHeader>
          <ModalBody className="text-foreground text-sm">Form content goes here.</ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="default">Save</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    );
  },
};

// ─── Scrollable ───────────────────────────────────────────────────────────────

/**
 * Demonstrates Modal-spec §8: ModalContent caps height; ModalBody scrolls;
 * header and footer remain pinned.
 */
export const Scrollable: Story = {
  name: "Scrollable (ModalBody overflow — spec §8)",
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button variant="secondary">Open scrollable modal…</Button>
        </ModalTrigger>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Scrollable content</ModalTitle>
            <ModalDescription>
              Header stays pinned. Body scrolls. Footer stays pinned.
            </ModalDescription>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i} className="text-foreground mb-3 text-sm">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Paragraph {i + 1} of 20.
              </p>
            ))}
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    );
  },
};

// ─── Destructive ──────────────────────────────────────────────────────────────

export const Destructive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);

    return (
      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button variant="destructive">Delete skill…</Button>
        </ModalTrigger>
        <ModalContent
          size="sm"
          variant="destructive"
          role="alertdialog"
          initialFocus={cancelRef}
          dismissOnScrim={false}
        >
          <ModalHeader>
            <ModalTitle>Delete skill &apos;security-review&apos;?</ModalTitle>
            <ModalDescription>
              This removes{" "}
              <code className="bg-surface-muted rounded px-1 py-0.5 font-mono text-xs">
                ~/.claude/skills/security-review/SKILL.md
              </code>{" "}
              and cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button ref={cancelRef} variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Delete skill
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    );
  },
};

// ─── ExpandedScopeConfirmation ────────────────────────────────────────────────

export const ExpandedScopeConfirmation: Story = {
  name: "ExpandedScopeConfirmation (Strict Mode opt-in)",
  render: () => {
    const [open, setOpen] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);

    return (
      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button variant="secondary">Enable Strict Mode…</Button>
        </ModalTrigger>
        <ModalContent size="sm" variant="expanded-scope-confirmation" initialFocus={cancelRef}>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Icon name="shield" size="md" className="text-info" aria-hidden="true" />
              <ModalTitle>Enable Strict Mode?</ModalTitle>
            </div>
          </ModalHeader>
          <div className="text-foreground space-y-3 px-6 py-2 text-sm">
            <p>
              ZoePlane will quarantine hooks discovered or modified externally instead of letting
              them fire immediately.
            </p>
            <div>
              <p className="font-medium">What changes immediately:</p>
              <ul className="text-foreground-muted mt-1 ml-4 list-disc space-y-1">
                <li>Future hooks discovered or edited externally are quarantined automatically.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">What does NOT change:</p>
              <ul className="text-foreground-muted mt-1 ml-4 list-disc space-y-1">
                <li>Existing hooks (active or disabled) are unaffected.</li>
                <li>
                  Your settings.json file content is preserved verbatim — only the JSON key changes.
                </li>
                <li>You can disable Strict Mode at any time.</li>
              </ul>
            </div>
          </div>
          <ModalFooter>
            <Button ref={cancelRef} variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => setOpen(false)}>
              Enable Strict Mode
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    );
  },
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const Sizes: Story = {
  name: "Sizes (sm / md / lg matrix)",
  render: () => {
    const [which, setWhich] = useState<"sm" | "md" | "lg" | null>(null);

    return (
      <div className="flex gap-3">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size}>
            <Button variant="outline" size="sm" onClick={() => setWhich(size)}>
              {size}
            </Button>
            <ModalRoot open={which === size} onOpenChange={(o) => setWhich(o ? size : null)}>
              <ModalContent size={size}>
                <ModalHeader>
                  <ModalTitle>Modal size: {size}</ModalTitle>
                  <ModalDescription>
                    Max-width {{ sm: "400px", md: "560px", lg: "720px" }[size]}.
                  </ModalDescription>
                  <ModalClose />
                </ModalHeader>
                <div className="text-foreground-muted px-6 py-4 text-sm">Body content area.</div>
                <ModalFooter>
                  <Button variant="secondary" onClick={() => setWhich(null)}>
                    Close
                  </Button>
                </ModalFooter>
              </ModalContent>
            </ModalRoot>
          </div>
        ))}
      </div>
    );
  },
};

// ─── FocusManagement ──────────────────────────────────────────────────────────

export const FocusManagement: Story = {
  name: "FocusManagement (initialFocus + return-focus)",
  render: () => {
    const [open, setOpen] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);

    return (
      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button variant="secondary">Open (Cancel auto-focused)</Button>
        </ModalTrigger>
        <ModalContent size="sm" initialFocus={cancelRef} role="alertdialog">
          <ModalHeader>
            <ModalTitle>Confirm action</ModalTitle>
            <ModalDescription>
              Cancel should receive focus on open. Trigger should regain focus on close.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button ref={cancelRef} variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => setOpen(false)}>
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    );
  },
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (A-07 / A-08 — frame fade only)",
  decorators: [
    (Story) => (
      <div className="prefers-reduced-motion">
        <Story />
      </div>
    ),
  ],
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button variant="secondary">Open (reduced motion)</Button>
        </ModalTrigger>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Reduced motion</ModalTitle>
            <ModalDescription>
              Frame fades only — no scale animation under prefers-reduced-motion.
            </ModalDescription>
            <ModalClose />
          </ModalHeader>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    );
  },
};
