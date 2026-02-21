#!/usr/bin/env python3
"""ReasonDB plugin wrapper for Microsoft MarkItDown.

Reads a JSON request from stdin, extracts content using markitdown,
and writes a JSON response to stdout.

Requires: pip install 'markitdown[all]'
"""
import json
import sys
import os


def extract_file(path: str) -> dict:
    from markitdown import MarkItDown

    md = MarkItDown()
    result = md.convert(path)
    title = os.path.splitext(os.path.basename(path))[0]
    return {
        "title": title,
        "markdown": result.text_content,
        "metadata": {},
    }


def extract_url(url: str) -> dict:
    from markitdown import MarkItDown

    md = MarkItDown()
    result = md.convert(url)

    title = "Untitled"
    for line in result.text_content.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
            break

    return {
        "title": title,
        "markdown": result.text_content,
        "metadata": {"url": url},
    }


def main():
    raw = sys.stdin.read()
    try:
        request = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"version": 1, "status": "error", "error": f"Invalid JSON: {e}"}, sys.stdout)
        return

    operation = request.get("operation", "")
    params = request.get("params", {})

    if operation != "extract":
        json.dump(
            {"version": 1, "status": "error", "error": f"Unsupported operation: {operation}"},
            sys.stdout,
        )
        return

    try:
        source_type = params.get("source_type", "file")
        if source_type == "url":
            url = params.get("url", "")
            if not url:
                raise ValueError("Missing 'url' parameter")
            result = extract_url(url)
        else:
            path = params.get("path", "")
            if not path:
                raise ValueError("Missing 'path' parameter")
            result = extract_file(path)

        json.dump({"version": 1, "status": "ok", "result": result}, sys.stdout)

    except Exception as e:
        json.dump({"version": 1, "status": "error", "error": str(e)}, sys.stdout)


if __name__ == "__main__":
    main()
