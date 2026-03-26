from __future__ import annotations

import argparse
import math
import os
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class UmlBox:
    kind: str  # 'class' | 'enum' | other
    name: str
    body_lines: List[str]


@dataclass
class UmlEdge:
    src: str
    dst: str
    arrow: str
    label: str


CLASS_BLOCK_RE = re.compile(r"^(class|interface|abstract\s+class)\s+([A-Za-z0-9_$.]+)\s*\{\s*$")
ENUM_BLOCK_RE = re.compile(r"^enum\s+([A-Za-z0-9_$.]+)\s*\{\s*$")
REL_RE = re.compile(
    r"^([A-Za-z0-9_$.]+)\s+([.\-*o<|/\\]+--+>?|--+>?|\.\.+>?|<\|--|\*--|o--|\+--|--\|>|-->?|<-->)\s+([A-Za-z0-9_$.]+)\s*(?::\s*(.*))?$"
)


def _clean_member_line(line: str) -> str:
    return line.rstrip("\n").rstrip("\r")


def parse_puml(text: str) -> Tuple[List[UmlBox], List[UmlEdge], str]:
    boxes: List[UmlBox] = []
    edges: List[UmlEdge] = []

    title = ""
    lines = text.splitlines()

    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.strip()

        if line.lower().startswith("title "):
            title = raw.strip()[6:].strip()
            i += 1
            continue

        if not line or line.startswith("'"):
            i += 1
            continue

        if line.startswith("@") or line.startswith("skinparam") or line.startswith("hide "):
            i += 1
            continue

        m_class = CLASS_BLOCK_RE.match(line)
        if m_class:
            kind = "class"
            name = m_class.group(2)
            body: List[str] = []
            i += 1
            while i < len(lines):
                inner = lines[i]
                if inner.strip() == "}":
                    break
                inner_stripped = inner.rstrip("\n").rstrip("\r")
                if inner_stripped.strip() != "":
                    body.append(_clean_member_line(inner_stripped.strip()))
                i += 1
            boxes.append(UmlBox(kind=kind, name=name, body_lines=body))
            i += 1
            continue

        m_enum = ENUM_BLOCK_RE.match(line)
        if m_enum:
            kind = "enum"
            name = m_enum.group(1)
            body: List[str] = []
            i += 1
            while i < len(lines):
                inner = lines[i]
                if inner.strip() == "}":
                    break
                inner_stripped = inner.rstrip("\n").rstrip("\r")
                if inner_stripped.strip() != "":
                    body.append(_clean_member_line(inner_stripped.strip()))
                i += 1
            boxes.append(UmlBox(kind=kind, name=name, body_lines=body))
            i += 1
            continue

        m_rel = REL_RE.match(line)
        if m_rel:
            src, arrow, dst, label = m_rel.group(1), m_rel.group(2), m_rel.group(3), m_rel.group(4) or ""
            # Normalize arrow a bit; we don't need exact semantics for draw.io rendering.
            edges.append(UmlEdge(src=src, dst=dst, arrow=arrow, label=label.strip()))
            i += 1
            continue

        i += 1

    return boxes, edges, title


def xml_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def to_drawio_value(box: UmlBox) -> str:
    header = f"<div><b>{xml_escape(box.name)}</b>"
    if box.kind == "enum":
        header += " <i>&lt;&lt;enum&gt;&gt;</i>"
    header += "</div>"

    if not box.body_lines:
        return header

    body = "<div style=\"margin-top:4px;\">" + "<br/>".join(xml_escape(x) for x in box.body_lines) + "</div>"
    return header + body


def estimate_size(box: UmlBox) -> Tuple[int, int]:
    # Very rough sizing to avoid all boxes overlapping.
    lines = [box.name] + box.body_lines
    max_len = max((len(l) for l in lines), default=len(box.name))
    line_count = max(1, len(lines))

    char_w = 6.5
    line_h = 16
    padding_w = 40
    padding_h = 20

    w = int(min(520, max(180, math.ceil(max_len * char_w) + padding_w)))
    h = int(min(420, max(60, line_count * line_h + padding_h)))
    return w, h


def build_drawio(boxes: List[UmlBox], edges: List[UmlEdge], title: str) -> str:
    # IDs
    next_id = 2
    cell_id_by_name: Dict[str, str] = {}

    mxfile = ET.Element("mxfile", attrib={
        "host": "app.diagrams.net",
        "modified": "2026-03-23T00:00:00.000Z",
        "agent": "puml_to_drawio.py",
        "version": "24.7.10",
        "type": "device",
    })

    diagram = ET.SubElement(mxfile, "diagram", attrib={"id": "puml", "name": title or "Page-1"})

    model = ET.SubElement(diagram, "mxGraphModel", attrib={
        "dx": "1200",
        "dy": "800",
        "grid": "1",
        "gridSize": "10",
        "guides": "1",
        "tooltips": "1",
        "connect": "1",
        "arrows": "1",
        "fold": "1",
        "page": "1",
        "pageScale": "1",
        "pageWidth": "1169",
        "pageHeight": "827",
        "math": "0",
        "shadow": "0",
    })

    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", attrib={"id": "0"})
    ET.SubElement(root, "mxCell", attrib={"id": "1", "parent": "0"})

    # Simple grid layout
    cols = 3
    x0, y0 = 40, 40
    x_gap, y_gap = 40, 40

    for idx, box in enumerate(boxes):
        w, h = estimate_size(box)
        col = idx % cols
        row = idx // cols
        x = x0 + col * (520 + x_gap)
        y = y0 + row * (420 + y_gap)

        cid = str(next_id)
        next_id += 1
        cell_id_by_name[box.name] = cid

        style = "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;"
        if box.kind == "enum":
            style += "dashed=1;"

        cell = ET.SubElement(root, "mxCell", attrib={
            "id": cid,
            "value": to_drawio_value(box),
            "style": style,
            "vertex": "1",
            "parent": "1",
        })
        ET.SubElement(cell, "mxGeometry", attrib={
            "x": str(x),
            "y": str(y),
            "width": str(w),
            "height": str(h),
            "as": "geometry",
        })

    # Add edges
    for e in edges:
        if e.src not in cell_id_by_name or e.dst not in cell_id_by_name:
            continue
        eid = str(next_id)
        next_id += 1

        style = "endArrow=block;endFill=1;edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;"
        if ".." in e.arrow:
            style += "dashed=1;"

        edge_cell = ET.SubElement(root, "mxCell", attrib={
            "id": eid,
            "value": xml_escape(e.label) if e.label else "",
            "style": style,
            "edge": "1",
            "parent": "1",
            "source": cell_id_by_name[e.src],
            "target": cell_id_by_name[e.dst],
        })
        ET.SubElement(edge_cell, "mxGeometry", attrib={"relative": "1", "as": "geometry"})

    # Serialize
    xml_str = ET.tostring(mxfile, encoding="utf-8")
    return xml_str.decode("utf-8")


def convert_file(src_path: Path, out_path: Path) -> None:
    text = src_path.read_text(encoding="utf-8")
    boxes, edges, title = parse_puml(text)
    if not boxes:
        raise RuntimeError(f"No classes/enums found in {src_path}")
    xml = build_drawio(boxes, edges, title=title)
    out_path.write_text(xml, encoding="utf-8")


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Convert simple PlantUML class diagrams (.puml) to draw.io (.drawio) XML")
    p.add_argument("inputs", nargs="+", help="Input .puml files or directories")
    p.add_argument("--out-dir", default="", help="Output directory (defaults to alongside input files)")
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing .drawio files")

    args = p.parse_args(argv)

    input_paths: List[Path] = [Path(x) for x in args.inputs]
    out_dir = Path(args.out_dir) if args.out_dir else None

    puml_files: List[Path] = []
    for ip in input_paths:
        if ip.is_dir():
            puml_files.extend(sorted(ip.glob("**/*.puml")))
        else:
            puml_files.append(ip)

    if not puml_files:
        print("No .puml files found", file=sys.stderr)
        return 2

    converted = 0
    for src in puml_files:
        if src.suffix.lower() != ".puml":
            continue
        target_dir = out_dir if out_dir else src.parent
        target_dir.mkdir(parents=True, exist_ok=True)
        out = target_dir / (src.stem + ".drawio")
        if out.exists() and not args.overwrite:
            continue
        convert_file(src, out)
        converted += 1

    print(f"Converted {converted} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
