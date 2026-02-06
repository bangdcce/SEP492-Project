
from html.parser import HTMLParser
import re

class DescriptionRefiner(HTMLParser):
    def __init__(self):
        super().__init__()
        self.output = []
        self.current_table_name = ""
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cell_content = ""
        self.row_data = [] # List of cell contents
        self.row_attrs = [] # List of cell attributes
        self.row_tr_attr = ""
        self.col_map = {}
        
        # Generic phrases to replace
        self.generic_phrases = [
            "name of the entity.", "title of the entity.", 
            "detailed description of the activity or entity.",
            "unique identifier for the record.", # Maybe keep this for 'id'? Or make it "Unique identifier for the [Table]."
            "current status of the process (e.g., open, resolved).", # Too specific if not a process
            "timestamp when the record was created.", # Keep or refine?
            "timestamp when the record was last updated.",
            "name.", "title.", "description.", "status.", "type."
        ]

    def handle_data(self, data):
        if self.in_cell:
            self.cell_content += data
        else:
            # Check for table name in h2 text
            # Format: 1. TABLE: audit_logs
            if "TABLE:" in data:
                match = re.search(r'TABLE:\s*(\w+)', data)
                if match:
                    self.current_table_name = match.group(1)
            self.output.append(data)

    def handle_starttag(self, tag, attrs):
        attr_str = ""
        for a in attrs:
            val = a[1] if a[1] is not None else ""
            val = val.replace('"', '&quot;')
            attr_str += f' {a[0]}="{val}"'
        
        if tag == 'table':
            self.in_table = True
            self.col_map = {}
            self.output.append(f"<{tag}{attr_str}>")
            return
            
        if tag == 'tr':
            self.in_row = True
            self.row_data = []
            self.row_attrs = []
            self.row_tr_attr = attr_str
            return

        if tag == 'td' or tag == 'th':
            self.in_cell = True
            self.cell_content = ""
            self.row_attrs.append(attr_str)
            return

        if self.in_cell:
            self.cell_content += f"<{tag}{attr_str}>"
            return
            
        self.output.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag):
        if tag == 'table':
            self.in_table = False
            self.output.append(f"</{tag}>")
            return
            
        if tag == 'tr':
            self.in_row = False
            self.process_row()
            return
            
        if tag == 'td' or tag == 'th':
            self.in_cell = False
            self.row_data.append(self.cell_content)
            return
            
        if self.in_cell:
            self.cell_content += f"</{tag}>"
            return
            
        self.output.append(f"</{tag}>")

    def format_table_name(self, table_name):
        # contracts -> contract
        # audit_logs -> audit log
        name = table_name.replace('_', ' ')
        if name.endswith('ies'): # activity_logs -> activities -> activity ?? simple plural check
            name = name[:-3] + 'y'
        elif name.endswith('s') and not name.endswith('ss'):
            name = name[:-1]
        return name

    def process_row(self):
        cells = self.row_data
        
        # Identify columns if header
        clean_cells = [re.sub(r'<[^>]+>', '', c).strip().lower() for c in cells]
        if 'attribute' in clean_cells and 'description' in clean_cells:
            for idx, txt in enumerate(clean_cells):
                self.col_map[txt] = idx
            self.write_row_raw(cells, self.row_attrs, "th")
            return
            
        if not self.col_map:
             self.col_map = {
                 'attribute': 0, 'data type': 1, 'size': 2, 
                 'pk': 3, 'fk': 4, 'not null': 5, 'unique': 6, 'description': 7
             }
        
        att_idx = self.col_map.get('attribute', 0)
        desc_idx = self.col_map.get('description', 7)
        
        if att_idx < len(cells) and desc_idx < len(cells):
            att_name = re.sub(r'<[^>]+>', '', cells[att_idx]).strip()
            curr_desc = re.sub(r'<[^>]+>', '', cells[desc_idx]).strip()
            
            singular_table = self.format_table_name(self.current_table_name)
            
            new_desc = curr_desc
            
            # Refine Patterns
            lower_desc = curr_desc.lower().strip()
            lower_att = att_name.lower().strip()
            
            is_generic = False
            if not lower_desc: is_generic = True
            elif lower_desc == lower_att: is_generic = True
            elif lower_desc == f"{lower_att}.": is_generic = True
            elif lower_desc in self.generic_phrases: is_generic = True
            # Catch "Name of the entity." type stuff specifically
            elif "of the entity" in lower_desc: is_generic = True 
            elif "of the record" in lower_desc and lower_att != 'id': is_generic = True
            
            if is_generic:
                if lower_att == 'id':
                    new_desc = f"Unique identifier for the {singular_table}."
                elif lower_att == 'name':
                    new_desc = f"Name of the {singular_table}."
                elif lower_att == 'title':
                    new_desc = f"Title of the {singular_table}."
                elif lower_att == 'description':
                    new_desc = f"Description of the {singular_table}."
                elif lower_att == 'notes':
                    new_desc = f"Notes related to the {singular_table}."
                elif lower_att == 'status':
                    new_desc = f"Current status of the {singular_table}."
                elif lower_att == 'type':
                    new_desc = f"Type or classification of the {singular_table}."
                elif lower_att == 'created_at' or lower_att == 'createdat':
                    new_desc = f"Date and time when the {singular_table} was created."
                elif lower_att == 'updated_at' or lower_att == 'updatedat':
                    new_desc = f"Date and time when the {singular_table} was last updated."
                elif lower_att.endswith('id'):
                    # e.g. project_id -> Project
                    base = att_name[:-2]
                    if base.endswith('_'): base = base[:-1] # project_
                    ref_name = base.replace('_', ' ').capitalize()
                    # camelCase check?
                    if base.lower() != base: # likely camelCase like projectId
                        # split camel case
                        ref_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', base).capitalize()
                    
                    new_desc = f"Foreign key referencing the {ref_name}."
                else:
                    # Generic fallback that includes table name
                    human_att = att_name.replace('_', ' ').capitalize()
                    # handled camelCase
                    human_att = re.sub(r'([a-z])([A-Z])', r'\1 \2', human_att)
                    new_desc = f"{human_att} of the {singular_table}."

            cells[desc_idx] = new_desc

        self.write_row_raw(cells, self.row_attrs, "td")

    def write_row_raw(self, cells, attrs, cell_tag):
        self.output.append(f"<tr{self.row_tr_attr}>")
        for i, c in enumerate(cells):
            a = attrs[i] if i < len(attrs) else ""
            self.output.append(f"<{cell_tag}{a}>{c}</{cell_tag}>")
        self.output.append("</tr>")

with open('database_structure.html', 'r', encoding='utf-8') as f:
    content = f.read()

p = DescriptionRefiner()
p.feed(content)

with open('database_structure.html', 'w', encoding='utf-8') as f:
    f.write("".join(p.output))
