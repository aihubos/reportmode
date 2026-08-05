#!/usr/bin/env python3
"""Render the fixed report shell from a flat JSON object."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

TOKEN = re.compile(r"\{\{([A-Z0-9_]+)\}\}")


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--template",default=str(Path(__file__).resolve().parent.parent/"templates"/"report-shell.html"))
    ap.add_argument("--data",required=True,help="Flat JSON object; HTML fields may contain trusted authored HTML")
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    template=Path(args.template).expanduser().resolve()
    data_path=Path(args.data).expanduser().resolve()
    output=Path(args.output).expanduser().resolve()
    raw=template.read_text(encoding="utf-8")
    data=json.loads(data_path.read_text(encoding="utf-8"))
    if not isinstance(data,dict): raise SystemExit("data must be a JSON object")
    data.setdefault("REPORT_BRAND", "AI Report")
    data.setdefault("PUBLISHER_LABEL", "Local Report")
    required=set(TOKEN.findall(raw))
    missing=sorted(key for key in required if key not in data)
    if missing: raise SystemExit(f"missing template fields: {', '.join(missing)}")
    rendered=TOKEN.sub(lambda m:str(data[m.group(1)]),raw)
    unresolved=sorted(set(TOKEN.findall(rendered)))
    if unresolved: raise SystemExit(f"unresolved template fields: {', '.join(unresolved)}")
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(rendered,encoding="utf-8")
    print(f"PASS output={output} bytes={output.stat().st_size} fields={len(required)}")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
