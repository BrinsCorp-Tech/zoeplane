# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for ZoePlane. Each ADR documents a significant architectural decision, the context that drove it, the decision made, and its consequences.

## Index

| ADR | Title | Status | Date | Summary |
|-----|-------|--------|------|---------|
| [ADR-001](ADR-001-bundle-identifier.md) | Bundle Identifier for ZoePlane Tauri App | Accepted | 2026-05-09 | Retains `com.brinscorp.zoeplane` as the permanent Tauri bundle identifier; rationale is honest correspondence with the signing trust root (BrinsCorp-Tech Apple Developer cert). |

## Format

ADRs in this directory follow the format:

- **Status:** Proposed / Accepted / Deprecated / Superseded
- **Context:** What situation or question drove this decision
- **Decision:** The choice made and why
- **Consequences:** What becomes easier, harder, or must be tracked as a result
