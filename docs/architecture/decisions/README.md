# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for ZoePlane. Each ADR documents a significant architectural decision, the context that drove it, the decision made, and its consequences.

## Index

| ADR                                             | Title                                    | Status   | Date       | Summary                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR-001](ADR-001-bundle-identifier.md)         | Bundle Identifier for ZoePlane Tauri App | Accepted | 2026-05-09 | Retains `com.brinscorp.zoeplane` as the permanent Tauri bundle identifier; rationale is honest correspondence with the signing trust root (BrinsCorp-Tech Apple Developer cert).                                                                                                  |
| [ADR-002](ADR-002-tauri-2x-capability-model.md) | Tauri 2.x Capability Model               | Accepted | 2026-05-10 | Adopts Tauri 2.x's capability-based ACL system; locks four invariants (single `capabilities/default.json`, identifier enumeration over `<plugin>:default`, sidecar grants in capabilities not `tauri.conf.json`, hard split between plugin configuration and plugin permissions). |

## Format

ADRs in this directory follow the format:

- **Status:** Proposed / Accepted / Deprecated / Superseded
- **Context:** What situation or question drove this decision
- **Decision:** The choice made and why
- **Consequences:** What becomes easier, harder, or must be tracked as a result
