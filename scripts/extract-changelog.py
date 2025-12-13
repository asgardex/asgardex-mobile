#!/usr/bin/env python3
"""Extract changelog section for a specific version from CHANGELOG.md."""

import re
import sys


def extract_changelog(version: str, changelog_path: str = "CHANGELOG.md") -> str:
    """Extract the changelog content for a specific version.

    Args:
        version: The version to extract (e.g., "1.41.5")
        changelog_path: Path to the CHANGELOG.md file

    Returns:
        The changelog content for that version, or empty string if not found
    """
    with open(changelog_path, "r") as f:
        content = f.read()

    # Match from "# {version}" until the next "# X.Y.Z" (semver) or end of file
    pattern = rf"^# {re.escape(version)}\b.*?(?=^# \d+\.\d+\.\d+|\Z)"
    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)

    if match:
        # Remove the version header line, keep only the content
        lines = match.group(0).split("\n")[1:]
        return "\n".join(lines).strip()

    return ""


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: extract-changelog.py <version> [changelog_path]", file=sys.stderr)
        sys.exit(1)

    version = sys.argv[1]
    changelog_path = sys.argv[2] if len(sys.argv) > 2 else "CHANGELOG.md"

    result = extract_changelog(version, changelog_path)
    if result:
        print(result)
