#!/usr/bin/env python3
"""
Parse all DBML files from docs/Database Design/ and generate
Google-Docs-ready HTML tables saved to docs/html/database design/
"""
import os
import re
import glob

# ── Config ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DBML_DIR = os.path.join(BASE_DIR, "docs", "Database Design")
OUTPUT_DIR = os.path.join(BASE_DIR, "docs", "html", "database design")

MODULES = [
    "01-User-Auth",
    "02-Project-Request",
    "03-Project-Management",
    "04-Payment-Wallet",
    "05-Dispute-Resolution",
    "06-Skills-Taxonomy",
    "07-Trust-Moderation",
    "08-Calendar-Scheduling",
    "09-Staff-Management",
]

MODULE_TITLES = {
    "01-User-Auth": "Module 01 — User & Auth",
    "02-Project-Request": "Module 02 — Project Request / Wizard",
    "03-Project-Management": "Module 03 — Project Management",
    "04-Payment-Wallet": "Module 04 — Payment & Wallet",
    "05-Dispute-Resolution": "Module 05 — Dispute Resolution",
    "06-Skills-Taxonomy": "Module 06 — Skills & Taxonomy",
    "07-Trust-Moderation": "Module 07 — Trust & Moderation",
    "08-Calendar-Scheduling": "Module 08 — Calendar & Scheduling",
    "09-Staff-Management": "Module 09 — Staff Management",
}

# Tables that are external stubs and should be SKIPPED
EXTERNAL_STUBS = {
    "users", "projects", "milestones", "project_requests",
    "project_specs", "disputes", "notifications",
    "staff_leave_requests",
}

# ── Type Mapping (DBML → SQL Server) ─────────────────────────────────────

def map_type(dbml_type_raw):
    """Return (sql_type, size_str)"""
    t = dbml_type_raw.strip().strip('"').strip("'")
    tl = t.lower()

    if tl == "uuid":
        return "uniqueidentifier", "-"
    if tl == "boolean":
        return "bit", "-"
    if tl in ("timestamp", "timestamptz"):
        return "datetime2", "-"
    if tl == "date":
        return "date", "-"
    if tl == "time":
        return "time", "-"
    if tl == "int":
        return "int", "-"
    if tl == "text":
        return "nvarchar", "MAX"
    if tl in ("text[]", "varchar[]"):
        return "nvarchar", "MAX"
    if tl == "jsonb":
        return "nvarchar", "MAX"

    # varchar(N)
    m = re.match(r'varchar\((\d+)\)', tl)
    if m:
        return "nvarchar", m.group(1)
    if tl == "varchar":
        return "nvarchar", "MAX"

    # decimal(x,y)
    m = re.match(r'decimal\((\d+,\d+)\)', tl)
    if m:
        return f"decimal({m.group(1)})", "-"

    # Enum types — map to nvarchar(50)
    # Anything else that doesn't match standard types should be an enum
    return "nvarchar", "50"


# ── DBML Parser ──────────────────────────────────────────────────────────

def parse_dbml(filepath):
    """Parse a DBML file and return list of (table_name, fields)
    Each field: {name, type, size, unique, not_null, pk_fk, notes}
    """
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    tables = []
    # Find all Table blocks
    # Pattern: Table table_name { ... }
    table_pattern = re.compile(
        r'Table\s+(\w+)\s*\{(.*?)\n\}',
        re.DOTALL
    )

    for match in table_pattern.finditer(content):
        table_name = match.group(1)
        body = match.group(2)

        # Skip stub tables
        if table_name in EXTERNAL_STUBS:
            # Check if this is a stub (very short definition, just id)
            lines = [l.strip() for l in body.strip().split('\n') if l.strip()]
            field_lines = [l for l in lines if not l.startswith('//') and not l.startswith('Note:') and not l.startswith('indexes') and not l.startswith('(') and not l.startswith('}')]
            # If it only has 'id' field and 'Defined in Module' note, skip
            if len(field_lines) <= 1:
                continue
            # Check for 'Defined in Module' note
            if any('Defined in Module' in l for l in lines):
                continue

        fields = parse_table_body(body)
        if fields:
            tables.append((table_name, fields))

    return tables


def parse_table_body(body):
    """Parse table body and return list of field dicts"""
    fields = []
    lines = body.strip().split('\n')
    in_indexes = False
    in_note = False

    for line in lines:
        stripped = line.strip()

        # Skip empty lines and comments
        if not stripped or stripped.startswith('//'):
            continue

        # Skip indexes block
        if stripped.startswith('indexes'):
            in_indexes = True
            continue
        if in_indexes:
            if stripped == '}':
                in_indexes = False
            continue

        # Skip table-level Note
        if stripped.startswith('Note:'):
            continue

        # Skip lines that are just closing brace
        if stripped == '}':
            continue

        # Try to parse as field
        field = parse_field_line(stripped)
        if field:
            fields.append(field)

    return fields


def parse_field_line(line):
    """Parse a single field line like:
    id uuid [pk, default: `gen_random_uuid()`]
    email varchar(255) [unique, not null, note: 'Login email']
    """
    # Remove trailing comments
    line = line.strip()
    if not line or line.startswith('//') or line.startswith('Note:') or line.startswith('indexes'):
        return None

    # Match: fieldName type [attributes]
    # Field name can contain underscores
    # Type can be quoted like "text[]" or contain parens like decimal(15,2)
    m = re.match(
        r'^(\w+)\s+'           # field name
        r'("?[\w\[\]().,]+"?)'  # type (possibly quoted)
        r'\s*'
        r'(\[.*\])?'           # optional attributes in brackets
        r'\s*$',
        line
    )
    if not m:
        return None

    field_name = m.group(1)
    raw_type = m.group(2).strip('"').strip("'")
    attrs_str = m.group(3) or ""

    sql_type, size = map_type(raw_type)

    # Parse attributes
    is_pk = False
    is_fk = False
    is_unique = False
    is_not_null = False
    note_text = ""

    if attrs_str:
        attrs_inner = attrs_str[1:-1]  # strip [ and ]

        # Check for pk
        if re.search(r'\bpk\b', attrs_inner):
            is_pk = True
            is_not_null = True

        # Check for unique
        if re.search(r'\bunique\b', attrs_inner):
            is_unique = True

        # Check for not null
        if re.search(r'\bnot\s+null\b', attrs_inner):
            is_not_null = True

        # Check for increment
        if re.search(r'\bincrement\b', attrs_inner):
            pass  # auto-increment, note it

        # Extract note
        note_match = re.search(r"note:\s*'([^']*)'", attrs_inner)
        if note_match:
            note_text = note_match.group(1)

        # Check if it's an FK from the note
        if 'FK →' in note_text or 'FK ->' in note_text:
            is_fk = True

    # Build PK/FK string
    pk_fk = ""
    if is_pk and is_fk:
        pk_fk = "PK, FK"
    elif is_pk:
        pk_fk = "PK"
    elif is_fk:
        pk_fk = "FK"

    # Build notes
    notes = note_text
    if not notes:
        notes = auto_generate_note(field_name, raw_type, is_pk, is_fk)

    return {
        "name": field_name,
        "type": sql_type,
        "size": size,
        "unique": "X" if is_unique else "",
        "not_null": "X" if is_not_null else "",
        "pk_fk": pk_fk,
        "notes": notes,
    }


def auto_generate_note(field_name, raw_type, is_pk, is_fk):
    """Auto-generate a note based on field name conventions"""
    fn = field_name.lower()

    if is_pk and fn == "id":
        return "Primary key"
    if fn == "createdat" or fn == "created_at":
        return "Record creation timestamp"
    if fn == "updatedat" or fn == "updated_at":
        return "Last update timestamp"
    if fn == "deletedat" or fn == "deleted_at":
        return "Soft-delete timestamp"
    if fn == "status":
        return "Current status"
    if fn == "isactive" or fn == "is_active":
        return "Active flag"
    if fn == "createdat":
        return "Creation timestamp"
    if fn == "description":
        return "Description"
    if fn == "title":
        return "Title"
    if fn == "name":
        return "Name"
    if fn == "email":
        return "Email address"
    if fn == "metadata":
        return "Additional metadata (JSON)"
    if fn == "notes" or fn == "note":
        return "Additional notes"
    if fn == "sortorder" or fn == "sort_order":
        return "Display sort order"

    return ""


# ── HTML Generator ───────────────────────────────────────────────────────

HEADER_BG = "#FDE9D9"
CELL_STYLE = "border: 1px solid #000000; padding: 4px 6px; font-size: 8pt; font-family: 'Times New Roman', serif;"
HEADER_STYLE = f"border: 1px solid #000000; padding: 4px 6px; font-size: 8pt; font-family: 'Times New Roman', serif; font-weight: bold; background-color: {HEADER_BG}; text-align: center;"


def generate_table_html(table_name, fields, table_number):
    """Generate HTML for a single table"""
    # Heading
    html = f'<h5 style="font-size: 11pt; font-family: \'Times New Roman\', serif;"><b><i>5.1.{table_number}. {table_name}</i></b></h5>\n'

    # Table
    html += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #000000; font-size: 8pt; font-family: \'Times New Roman\', serif;">\n'

    # Header row
    html += '  <tr>\n'
    headers = ["#", "Field name", "Type", "Size", "Unique", "Not Null", "PK/FK", "Notes"]
    for h in headers:
        html += f'    <th style="{HEADER_STYLE}">{h}</th>\n'
    html += '  </tr>\n'

    # Data rows
    for idx, field in enumerate(fields, 1):
        html += '  <tr>\n'
        html += f'    <td style="{CELL_STYLE} text-align: center;">{idx}</td>\n'
        html += f'    <td style="{CELL_STYLE}">{field["name"]}</td>\n'
        html += f'    <td style="{CELL_STYLE}">{field["type"]}</td>\n'
        html += f'    <td style="{CELL_STYLE} text-align: center;">{field["size"]}</td>\n'
        html += f'    <td style="{CELL_STYLE} text-align: center;">{field["unique"]}</td>\n'
        html += f'    <td style="{CELL_STYLE} text-align: center;">{field["not_null"]}</td>\n'
        html += f'    <td style="{CELL_STYLE} text-align: center;">{field["pk_fk"]}</td>\n'
        html += f'    <td style="{CELL_STYLE}">{field["notes"]}</td>\n'
        html += '  </tr>\n'

    html += '</table>\n<br/>\n'
    return html


def generate_module_html(module_name, module_title, tables, start_number):
    """Generate full HTML document for a module"""
    html = '<!DOCTYPE html>\n<html>\n<head>\n'
    html += f'  <meta charset="UTF-8">\n'
    html += f'  <title>{module_title}</title>\n'
    html += '</head>\n<body style="font-family: \'Times New Roman\', serif; font-size: 8pt;">\n\n'

    current_number = start_number
    for table_name, fields in tables:
        html += generate_table_html(table_name, fields, current_number)
        html += '\n'
        current_number += 1

    html += '</body>\n</html>\n'
    return html, current_number


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    global_counter = 1  # continuous table numbering
    total_tables = 0

    for module in MODULES:
        dbml_path = os.path.join(DBML_DIR, f"{module}.dbml")
        if not os.path.exists(dbml_path):
            print(f"WARNING: {dbml_path} not found, skipping.")
            continue

        tables = parse_dbml(dbml_path)
        if not tables:
            print(f"WARNING: No tables found in {module}")
            continue

        module_title = MODULE_TITLES.get(module, module)
        html_content, new_counter = generate_module_html(
            module, module_title, tables, global_counter
        )

        output_path = os.path.join(OUTPUT_DIR, f"{module}.html")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        table_count = new_counter - global_counter
        print(f"✓ {module}: {table_count} tables (5.1.{global_counter} – 5.1.{new_counter - 1}) → {output_path}")
        total_tables += table_count
        global_counter = new_counter

    print(f"\nTotal: {total_tables} tables across {len(MODULES)} modules")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
