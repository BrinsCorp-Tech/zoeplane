---
name: sigil-agent
description: Uses anchors & aliases for config reuse. Supports tags like !required and >folded blocks
model: claude-haiku-4-5
color: purple
---

# Sigil Agent

This fixture tests YAML sigil characters in values: & # ! | > % @ and backtick.
The DANGEROUS_CHARS_RE pattern matches any of these; Tier 2 pre-processor
wraps the value in double quotes so Bun.YAML.parse can handle it cleanly.
