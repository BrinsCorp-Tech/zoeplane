---
{{{ completely broken yaml |||
%TAG !foo! bar:
: : : : :
---

# Total Failure

This fixture is so malformed that none of the three tiers can produce any
usable data. No top-level key: value lines match KEY_VALUE_LINE_RE for any
allowlisted field. Result: mode=failed, data=null.
