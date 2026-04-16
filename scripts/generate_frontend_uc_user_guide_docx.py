from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any

from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Pt


REQUESTED_UCS = [
    "UC-06",
    "UC-07",
    "UC-43",
    "UC-44",
    "UC-45",
    "UC-46",
    "UC-47",
    "UC-48",
    "UC-49",
    "UC-79",
    "UC-80",
    "UC-81",
    "UC-85",
    "UC-86",
    "UC-87",
    "UC-88",
    "UC-89",
    "UC-90",
    "UC-91",
    "UC-92",
    "UC-93",
    "UC-94",
    "UC-95",
    "UC-96",
    "UC-97",
    "UC-98",
    "UC-101",
    "UC-105",
    "UC-106",
    "UC-107",
]


def uc_sort_key(uc_id: str) -> int:
    return int(uc_id.split("-")[1])


def strip_md_emphasis(value: str) -> str:
    cleaned = value.strip()
    cleaned = cleaned.replace("**", "")
    cleaned = cleaned.replace("`", "")
    return cleaned


def parse_section_body(body: str) -> dict[str, Any]:
    result: dict[str, Any] = {
        "roles": "",
        "entry_route": "",
        "labels": [],
        "steps": [],
        "edge_states": [],
        "confidence": "",
    }

    current_block: str | None = None

    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line or line == "---":
            continue

        if line.startswith("**Roles:**"):
            result["roles"] = strip_md_emphasis(line.replace("**Roles:**", "", 1))
            current_block = None
            continue

        if line.startswith("**Entry Route:"):
            # Handle both "Entry Route" and "Entry Routes"
            normalized = re.sub(r"^\*\*Entry Routes?:\*\*", "", line)
            result["entry_route"] = strip_md_emphasis(normalized)
            current_block = None
            continue

        if line == "**User-Facing Labels:**":
            current_block = "labels"
            continue

        if line == "**Step-by-Step UI Path:**":
            current_block = "steps"
            continue

        if line == "**Edge States:**":
            current_block = "edge_states"
            continue

        if line.startswith("**Confidence:**"):
            confidence = strip_md_emphasis(line.replace("**Confidence:**", "", 1))
            result["confidence"] = confidence
            current_block = None
            continue

        if current_block in {"labels", "edge_states"}:
            if line.startswith("- "):
                result[current_block].append(strip_md_emphasis(line[2:]))
            elif result[current_block]:
                result[current_block][-1] = f"{result[current_block][-1]} {strip_md_emphasis(line)}"
            continue

        if current_block == "steps":
            numbered = re.match(r"^(\d+)\.\s+(.+)$", line)
            if numbered:
                result["steps"].append(strip_md_emphasis(numbered.group(2)))
            elif result["steps"]:
                result["steps"][-1] = f"{result['steps'][-1]} {strip_md_emphasis(line)}"
            continue

    return result


def parse_uc_sections(content: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"^## \*\*(UC-\d+):\s*(.+?)\*\*\s*$", re.MULTILINE)
    matches = list(pattern.finditer(content))

    sections: list[dict[str, Any]] = []
    for index, match in enumerate(matches):
        uc_id = match.group(1)
        title = match.group(2).strip()

        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        body = content[start:end]

        parsed = parse_section_body(body)
        parsed["uc_id"] = uc_id
        parsed["title"] = title
        sections.append(parsed)

    return sections


def add_info_line(document: Document, label: str, value: str) -> None:
    paragraph = document.add_paragraph()
    run_label = paragraph.add_run(f"{label} ")
    run_label.bold = True
    run_value = paragraph.add_run(value if value else "(Khong co du lieu)")
    run_value.italic = False


def add_list(document: Document, items: list[str], style: str, empty_message: str) -> None:
    if not items:
        paragraph = document.add_paragraph(empty_message)
        paragraph.italic = True
        return

    for item in items:
        paragraph = document.add_paragraph(strip_md_emphasis(item), style=style)
        paragraph.paragraph_format.space_after = Pt(2)


def build_docx(sections: list[dict[str, Any]], output_path: Path) -> None:
    document = Document()

    normal_style = document.styles["Normal"]
    normal_style.font.name = "Times New Roman"
    normal_style.font.size = Pt(11)

    title = document.add_heading(
        "Huong dan thao tac Frontend chi tiet theo Use Case (UC-06 den UC-107)",
        level=0,
    )
    title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

    intro = document.add_paragraph(
        "Tai lieu nay huong dan thao tac tren giao dien nguoi dung theo tung UC, "
        "tap trung vao nut bam, bo loc, tab, trang thai va cac buoc xu ly thuc te."
    )
    intro.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT

    document.add_paragraph("Danh sach UC trong pham vi tai lieu:")
    for uc_id in REQUESTED_UCS:
        document.add_paragraph(uc_id, style="List Bullet")

    document.add_page_break()

    for index, section in enumerate(sections):
        document.add_heading(f"{section['uc_id']} - {section['title']}", level=1)

        add_info_line(document, "Muc tieu:", f"Huong dan nguoi dung su dung chuc nang {section['title']} tren UI.")
        add_info_line(document, "Vai tro su dung:", section.get("roles", ""))
        add_info_line(document, "Duong vao (route/menu):", section.get("entry_route", ""))
        add_info_line(document, "Do tin cay doi chieu:", section.get("confidence", ""))

        document.add_heading("1) Cac nut/nhan/chuc nang tren man hinh", level=2)
        add_list(
            document,
            section.get("labels", []),
            style="List Bullet",
            empty_message="Khong tim thay danh sach nut/nhan cu the trong code hien tai.",
        )

        document.add_heading("2) Trinh tu thao tac chi tiet tung buoc", level=2)
        add_list(
            document,
            section.get("steps", []),
            style="List Number",
            empty_message="Khong tim thay luong buoc thao tac chi tiet.",
        )

        document.add_heading("3) Trang thai dac biet va thong bao can biet", level=2)
        add_list(
            document,
            section.get("edge_states", []),
            style="List Bullet",
            empty_message="Khong tim thay edge state/noi dung thong bao bo sung.",
        )

        note = document.add_paragraph(
            "Luu y: Neu nut bi an/disable, hay kiem tra role, trang thai doi tuong "
            "(du an, milestone, hearing, dispute), va dieu kien nghiep vu truoc khi thao tac tiep."
        )
        note.italic = True

        if index < len(sections) - 1:
            document.add_page_break()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a detailed frontend user-guide DOCX from UC mapping markdown report."
    )
    parser.add_argument("--source", required=True, help="Path to the UC mapping markdown-like content file")
    parser.add_argument("--output", required=True, help="Path to output DOCX file")
    args = parser.parse_args()

    source_path = Path(args.source)
    output_path = Path(args.output)

    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")

    content = source_path.read_text(encoding="utf-8")
    sections = parse_uc_sections(content)

    section_map = {section["uc_id"]: section for section in sections}
    missing = [uc for uc in REQUESTED_UCS if uc not in section_map]
    if missing:
        raise RuntimeError(f"Missing UC sections in source report: {', '.join(missing)}")

    ordered_sections = [section_map[uc] for uc in sorted(REQUESTED_UCS, key=uc_sort_key)]
    build_docx(ordered_sections, output_path)

    print(f"Generated DOCX: {output_path}")
    print(f"Included UC sections: {len(ordered_sections)}")


if __name__ == "__main__":
    main()
