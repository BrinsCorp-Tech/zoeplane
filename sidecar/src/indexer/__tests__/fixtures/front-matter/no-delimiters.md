# No Delimiters

This file has no front-matter delimiters at all. There is no opening --- marker.
The validator marks this as invalid (no-front-matter warning category) — it
never reaches the YAML parser, so parseFrontMatter is not invoked for this case.

The fixture is here to document and test the no-delimiter path in validator.ts.
