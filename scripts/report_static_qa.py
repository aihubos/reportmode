#!/usr/bin/env python3
"""Static QA for report-mode HTML. Stdlib only."""
from __future__ import annotations

import argparse
import html
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
IGNORE = {"script", "style", "noscript"}
REQUIRED_SOURCE_HEADERS = ["유형", "자료명", "제공자·저작자", "날짜", "라이선스·상태", "사용 범위"]


class Node:
    def __init__(self, tag="document", attrs=None, parent=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.parent = parent
        self.children: list[Node] = []
        self.parts: list[str] = []

    def text(self):
        return " ".join(" ".join(self.parts).split())


class TreeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.ids: set[str] = set()
        self.refs: list[tuple[str, str]] = []
        self.nodes: list[Node] = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        self.nodes.append(node)
        if node.attrs.get("id"):
            self.ids.add(node.attrs["id"])
        for key in ("href", "src"):
            if node.attrs.get(key):
                self.refs.append((key, node.attrs[key]))
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        for node in self.stack:
            node.parts.append(data)


def local_target(repo: Path, report: Path, value: str) -> Path | None:
    value = html.unescape(value).strip()
    if not value or value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc or value.startswith("//"):
        return None
    path = unquote(parsed.path)
    return (repo / path.lstrip("/")) if path.startswith("/") else (report.parent / path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--report", required=True, help="Path relative to repo or absolute path")
    args = ap.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    report_arg = Path(args.report).expanduser()
    report = report_arg.resolve() if report_arg.is_absolute() else (repo / report_arg).resolve()
    failures: list[str] = []

    try:
        report.relative_to(repo)
    except ValueError:
        failures.append("report is outside repo")
    if not report.is_file():
        print(f"FAIL report missing: {report}")
        return 1

    raw = report.read_text(encoding="utf-8")
    parser = TreeParser()
    try:
        parser.feed(raw)
        parser.close()
    except Exception as exc:
        failures.append(f"HTML parse error: {exc}")

    title_nodes = [n for n in parser.nodes if n.tag == "title"]
    h1_nodes = [n for n in parser.nodes if n.tag == "h1"]
    if not title_nodes or not title_nodes[0].text():
        failures.append("missing non-empty <title>")
    if not h1_nodes or not h1_nodes[0].text():
        failures.append("missing non-empty <h1>")

    top_conclusions = [n for n in parser.nodes if "top-conclusion" in n.attrs.get("class", "").split()]
    verdict_lines = [n for n in parser.nodes if "verdict-line" in n.attrs.get("class", "").split()]
    highlight_sweeps = [n for n in parser.nodes if "highlight-sweep" in n.attrs.get("class", "").split()]
    top_conclusion_labels = [n for n in parser.nodes if "top-conclusion-label" in n.attrs.get("class", "").split()]
    if len(top_conclusions) != 1:
        failures.append(f"expected exactly one top conclusion block, found {len(top_conclusions)}")
    if len(top_conclusion_labels) != 1 or top_conclusion_labels[0].text() != "핵심 결론":
        failures.append("top conclusion must have exactly one visible '핵심 결론' label")
    if len(verdict_lines) != 3:
        failures.append(f"expected exactly three top conclusion lines, found {len(verdict_lines)}")
    elif any(not n.text() for n in verdict_lines):
        failures.append("top conclusion line is empty")
    verdict_texts = [n for n in parser.nodes if "verdict-text" in n.attrs.get("class", "").split()]
    if len(highlight_sweeps) != 3:
        failures.append(f"expected exactly three highlighted conclusion phrases, found {len(highlight_sweeps)}")
    if len(verdict_texts) != 3:
        failures.append(f"expected exactly three conclusion text spans, found {len(verdict_texts)}")
    else:
        for verdict_text in verdict_texts:
            marks = [n for n in highlight_sweeps if verdict_text in ancestors(n)]
            if len(marks) != 1 or marks[0].tag != "mark":
                failures.append("each conclusion line must contain exactly one highlighted <mark> phrase")
            elif marks[0].text() == verdict_text.text():
                failures.append("highlight only the core phrase, not the entire conclusion line")
            elif len(marks[0].text()) / max(1, len(verdict_text.text())) > 0.72:
                failures.append("highlighted conclusion phrase is too broad; keep it to the core wording")
    if top_conclusions and h1_nodes:
        top, h1 = top_conclusions[0], h1_nodes[0]
        siblings = h1.parent.children if h1.parent is not None and top.parent is h1.parent else []
        if not siblings or siblings.index(top) != siblings.index(h1) + 1:
            failures.append("top conclusion block must appear immediately after the report h1")

    view_switchers = [n for n in parser.nodes if "report-view-switcher" in n.attrs.get("class", "").split()]
    view_buttons = [n for n in parser.nodes if "report-view-button" in n.attrs.get("class", "").split()]
    simple_reports = [n for n in parser.nodes if n.attrs.get("id") == "simple-report" and "simple-report" in n.attrs.get("class", "").split()]
    simple_slides = [n for n in parser.nodes if "simple-slide" in n.attrs.get("class", "").split()]
    detail_reports = [n for n in parser.nodes if n.tag == "main" and "detail-report" in n.attrs.get("class", "").split()]
    view_scripts = [n for n in parser.nodes if n.tag == "script" and n.attrs.get("id") == "report-view-script"]
    body_nodes = [n for n in parser.nodes if n.tag == "body"]
    if len(view_switchers) != 1 or len(view_buttons) != 2:
        failures.append("report top must have exactly one two-button simple/detail switcher")
    elif {button.text().strip() for button in view_buttons} != {"간단", "상세"}:
        failures.append("report view buttons must be labeled 간단 and 상세")
    elif sum(button.attrs.get("aria-pressed") == "true" for button in view_buttons) != 1:
        failures.append("exactly one report view button must be pressed by default")
    if not body_nodes or body_nodes[0].attrs.get("data-report-view") != "detail":
        failures.append("detailed report must be the default view")
    detail_buttons = [button for button in view_buttons if button.text().strip() == "상세"]
    if len(detail_buttons) != 1 or detail_buttons[0].attrs.get("aria-pressed") != "true" or "is-active" not in detail_buttons[0].attrs.get("class", "").split():
        failures.append("detailed report button must be active and pressed by default")
    if len(simple_reports) != 1 or simple_reports[0].attrs.get("data-simple-pages") != "2" or "도표·인포그래픽 요약 장표 2장" not in simple_reports[0].text():
        failures.append("simple view must declare two visual summary sheets")
    if len(simple_slides) != 2 or not any("simple-slide-1" in n.attrs.get("class", "").split() for n in simple_slides) or not any("simple-slide-2" in n.attrs.get("class", "").split() for n in simple_slides):
        failures.append("simple view must contain exactly simple-slide-1 and simple-slide-2")
    if not any("simple-metric" in n.attrs.get("class", "") or "simple-bar" in n.attrs.get("class", "") for n in parser.nodes):
        failures.append("simple visual summary must contain chart or metric components")
    if "report-view-buttons::before" not in raw or "--apple-blue" not in raw:
        failures.append("simple/detail switcher must use the Apple-style large segmented-control contract")
    if len(detail_reports) != 1:
        failures.append("full report content must be wrapped in one detailed-report main")
    if len(view_scripts) != 1 or "reportView" not in raw or "aria-pressed" not in raw:
        failures.append("simple/detail view script must switch content and pressed state")
    if "setView(requested==='simple'?'simple':'detail')" not in raw or "if(!['simple','detail'].includes(view))view='detail'" not in raw:
        failures.append("view script must default to detail while honoring ?view=simple")
    if 'body[data-report-view="simple"] .detail-report' not in raw or 'body[data-report-view="detail"] .simple-report' not in raw:
        failures.append("view CSS must isolate simple and detailed report content")

    floating_menus = [n for n in parser.nodes if "floating-menu" in n.attrs.get("class", "").split()]
    floating_actions = [n for n in parser.nodes if "floating-action" in n.attrs.get("class", "").split()]
    if len(floating_menus) != 1:
        failures.append(f"expected exactly one floating menu, found {len(floating_menus)}")
    if not 4 <= len(floating_actions) <= 7:
        failures.append(f"expected 4-7 floating menu actions, found {len(floating_actions)}")
    for action in floating_actions:
        href = action.attrs.get("href", "")
        if action.tag != "a" or not href.startswith("#") or len(href) == 1:
            failures.append("floating menu actions must be anchor links to local section ids")
        if not action.text():
            failures.append("floating menu action has empty text")
        elif len(action.text().replace(" ", "")) < 5:
            failures.append(f"floating menu label is too abbreviated to explain its section: {action.text()!r}")
    tracker_scripts = [n for n in parser.nodes if n.tag == "script" and n.attrs.get("id") == "report-floating-nav-script"]
    if len(tracker_scripts) != 1 or "aria-current" not in raw or "is-active" not in raw:
        failures.append("floating menu must track the current section with is-active and aria-current")
    if ".floating-menu{position:fixed;left:auto;right:" not in raw:
        failures.append("desktop floating menu must be positioned in the right gutter between the report and scrollbar")
    pdf_buttons = [n for n in parser.nodes if n.tag == "a" and n.attrs.get("id") == "report-pdf-button" and "pdf-save-button" in n.attrs.get("class", "").split()]
    share_buttons = [n for n in parser.nodes if n.tag == "button" and n.attrs.get("id") == "report-share-button" and "share-report-button" in n.attrs.get("class", "").split()]
    utility_controls = [n for n in parser.nodes if "report-utility-controls" in n.attrs.get("class", "").split()]
    pdf_scripts = [n for n in parser.nodes if n.tag == "script" and n.attrs.get("id") == "report-pdf-script"]
    share_scripts = [n for n in parser.nodes if n.tag == "script" and n.attrs.get("id") == "report-share-script"]
    if len(pdf_buttons) != 1 or "PDF 저장" not in pdf_buttons[0].text() or "download" not in pdf_buttons[0].attrs:
        failures.append("report must have one direct-download PDF save link")
    elif len(utility_controls) != 1 or pdf_buttons[0].parent is not utility_controls[0]:
        failures.append("PDF save link must use a separate utility area outside the floating menu")
    elif floating_menus and pdf_buttons[0].parent is floating_menus[0]:
        failures.append("PDF save link must not overlap or live inside the floating navigation")
    if len(pdf_scripts) != 1 or "window.print()" in raw or "data-simple-url" not in raw or "data-detail-url" not in raw:
        failures.append("PDF save link must switch between pre-generated simple/detail files without opening print UI")
    if len(share_buttons) != 1 or "공유하기" not in share_buttons[0].text():
        failures.append("report must have one share button beside the PDF link")
    elif len(utility_controls) != 1 or share_buttons[0].parent is not utility_controls[0]:
        failures.append("share button must use the report utility area")
    if len(share_scripts) != 1 or "navigator.share" not in raw or "navigator.clipboard.writeText" not in raw:
        failures.append("share button must use Web Share with clipboard fallback")
    for marker, message in [
        ("@page{size:A4 portrait", "print CSS must use A4 portrait pages"),
        ("{{REPORT_BRAND}}" if "{{" in raw else "@bottom-left{content", "PDF footer must include the configurable report brand"),
        ("{{PUBLISHER_LABEL}}" if "{{" in raw else "@bottom-center{content", "PDF footer must include the configurable publisher label"),
        ("counter(page)", "PDF footer must include the current page number"),
        ("counter(pages)", "PDF footer must include the total page count"),
        ("{{DATE_LONG}}" if "{{" in raw else "KST", "PDF footer must include the report generation date"),
    ]:
        if marker not in raw:
            failures.append(message)
    if "@media print" not in raw:
        failures.append("missing @media print")

    for key, value in parser.refs:
        if value.startswith("#"):
            anchor = unquote(value[1:])
            if anchor and anchor not in parser.ids:
                failures.append(f"missing anchor target: {value}")
            continue
        target = local_target(repo, report, value)
        if target is not None and not target.exists():
            failures.append(f"missing local {key}: {value} -> {target}")

    reaction_sections = [n for n in parser.nodes if n.attrs.get("id") == "public-reaction"]
    reaction_cards = [n for n in parser.nodes if "reaction-card" in n.attrs.get("class", "").split()]
    if len(reaction_sections) != 1:
        failures.append(f"expected exactly one public reaction section, found {len(reaction_sections)}")
    if not 3 <= len(reaction_cards) <= 6:
        failures.append(f"expected 3-6 sourced public reaction cards, found {len(reaction_cards)}")
    for card in reaction_cards:
        links = [n for n in parser.nodes if n.tag == "a" and card in ancestors(n) and n.attrs.get("href", "").startswith(("http://", "https://"))]
        if not links:
            failures.append("each public reaction card must link to an accessible original source")
        if not any("reaction-meta" in n.attrs.get("class", "").split() and card in ancestors(n) for n in parser.nodes):
            failures.append("each public reaction card must identify platform, author or outlet, and date")

    tables = [n for n in parser.nodes if n.tag == "table"]
    source_tables = [t for t in tables if all(h in t.text() for h in REQUIRED_SOURCE_HEADERS)]
    if not source_tables:
        failures.append("missing full source table headers")
    else:
        last_source = source_tables[-1]
        source_headers = [n.text() for n in parser.nodes if n.tag == "th" and last_source in ancestors(n)]
        if not any(h in {"URL", "원문"} for h in source_headers):
            failures.append("full source table must include a URL or 원문 column")
        source_details = [n for n in ancestors(last_source) if n.tag == "details" and n.attrs.get("id") == "sources"]
        if len(source_details) != 1:
            failures.append("full source table must be inside an expandable <details id='sources'>")
        elif "open" in source_details[0].attrs:
            failures.append("full source details must be collapsed by default")
        elif not any(n.tag == "summary" and source_details[0] in ancestors(n) for n in parser.nodes):
            failures.append("full source details must have a keyboard-accessible summary")
        if ".sources th:nth-child(4),.sources td:nth-child(4){width:12%" not in raw:
            failures.append("source URL/original column must use the compact 12% width contract")
        later_substantive = []
        seen = False
        for node in parser.nodes:
            if node is last_source:
                seen = True
                continue
            if seen and node.tag not in IGNORE and node.text() and last_source not in ancestors(node):
                later_substantive.append(node.tag)
        if later_substantive:
            failures.append("source table is not the final substantive element")

    images = [n for n in parser.nodes if n.tag == "img"]
    if not images:
        failures.append("no <img> visual found")

    if failures:
        print("FAIL")
        for item in dict.fromkeys(failures):
            print(f"- {item}")
        return 1

    print("PASS")
    print(f"report={report}")
    print(f"title={title_nodes[0].text()}")
    source_rows = max(0, sum(1 for n in parser.nodes if n.tag == "tr" and source_tables[-1] in ancestors(n)) - 1)
    print(f"images={len(images)} local_refs_checked={sum(local_target(repo, report, v) is not None for _, v in parser.refs)}")
    print(f"source_rows={source_rows}")
    return 0


def ancestors(node: Node):
    result = []
    cur = node.parent
    while cur is not None:
        result.append(cur)
        cur = cur.parent
    return result


if __name__ == "__main__":
    sys.exit(main())
