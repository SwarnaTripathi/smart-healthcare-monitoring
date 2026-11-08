"""Generate formatted Word report from LaTeX source files."""
import re, os
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import nsdecls
from docx.oxml import parse_xml

BASE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(BASE, 'template_image.jpeg')
CHAP_DIR = os.path.join(BASE, 'report', 'chapters')

def add_borders(sec):
    sec._sectPr.append(parse_xml(
        '<w:pgBorders {} w:offsetFrom="page">'
        '<w:top w:val="thinThickSmallGap" w:sz="24" w:space="24" w:color="1F4E79"/>'
        '<w:left w:val="thinThickSmallGap" w:sz="24" w:space="24" w:color="1F4E79"/>'
        '<w:bottom w:val="thickThinSmallGap" w:sz="24" w:space="24" w:color="1F4E79"/>'
        '<w:right w:val="thickThinSmallGap" w:sz="24" w:space="24" w:color="1F4E79"/>'
        '</w:pgBorders>'.format(nsdecls('w'))))

def shade(cell, color):
    cell._tc.get_or_add_tcPr().append(
        parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}" w:val="clear"/>'))

def para(doc, text, sz=12, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, color=None, after=6, before=0, font='Times New Roman'):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    r = p.add_run(text)
    r.font.size = Pt(sz)
    r.font.bold = bold
    r.font.name = font
    if color: r.font.color.rgb = RGBColor(*color)
    return p

def make_table(doc, headers, rows, caption=None):
    if caption:
        para(doc, caption, sz=11, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=6)
    t = doc.add_table(rows=1+len(rows), cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = ''
        r = c.paragraphs[0].add_run(h)
        r.bold = True; r.font.size = Pt(10); r.font.name = 'Times New Roman'
        r.font.color.rgb = RGBColor(255,255,255)
        shade(c, '1F4E79')
    for ri, row in enumerate(rows):
        for ci, v in enumerate(row):
            c = t.rows[ri+1].cells[ci]; c.text = ''
            r = c.paragraphs[0].add_run(str(v))
            r.font.size = Pt(10); r.font.name = 'Times New Roman'
            if ri % 2 == 1: shade(c, 'D6E4F0')
    doc.add_paragraph()

def code_block(doc, code, cap=''):
    if cap: para(doc, cap, sz=10, bold=True, before=6)
    for ln in code.strip().split('\n'):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.left_indent = Inches(0.3)
        r = p.add_run(ln)
        r.font.size = Pt(8); r.font.name = 'Consolas'
        r.font.color.rgb = RGBColor(30,30,30)
        p._p.get_or_add_pPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F0F0F0" w:val="clear"/>'))
    doc.add_paragraph()

def read_tex(name):
    with open(os.path.join(CHAP_DIR, name), 'r', encoding='utf-8') as f:
        return f.read()

def clean(t):
    t = re.sub(r'\\textbf\{([^}]*)\}', r'\1', t)
    t = re.sub(r'\\textit\{([^}]*)\}', r'\1', t)
    t = re.sub(r'\\texttt\{([^}]*)\}', r'\1', t)
    t = re.sub(r'\\textdegree', '°', t)
    t = re.sub(r'\\checkmark', '✓', t)
    t = re.sub(r'\\texttimes', '✗', t)
    t = re.sub(r'\\url\{([^}]*)\}', r'\1', t)
    t = re.sub(r'\$[^$]*\$', '', t)
    t = re.sub(r'\\\\', ' ', t)
    t = re.sub(r'~', ' ', t)
    t = re.sub(r'\\&', '&', t)
    t = re.sub(r'---', '—', t)
    t = re.sub(r"''", '"', t)
    t = re.sub(r"``", '"', t)
    t = re.sub(r'\[\d+(\.\d+)?cm\]', '', t)
    t = re.sub(r'\[\d+(\.\d+)?pt\]', '', t)
    t = re.sub(r'\\[a-zA-Z]+\{([^}]*)\}', r'\1', t)
    t = re.sub(r'\\[a-zA-Z]+', '', t)
    t = re.sub(r'[{}]', '', t)
    return t.strip()

def parse_items(block):
    items = re.findall(r'\\item\s+(.*?)(?=\\item|\\end)', block, re.DOTALL)
    return [clean(i.strip()) for i in items if i.strip()]

def parse_table_rows(block):
    rows = []
    for line in block.split('\n'):
        if '&' in line and '\\hline' not in line and 'textbf' not in line.replace('\\textbf',''):
            cells = [clean(c.strip().rstrip('\\').strip()) for c in line.split('&')]
            if any(c for c in cells):
                rows.append(cells)
    # headers
    hdrs = []
    for line in block.split('\n'):
        if '&' in line and 'textbf' in line:
            hdrs = [clean(c.strip().rstrip('\\').strip()) for c in line.split('&')]
            break
    return hdrs, rows

def parse_code(block):
    m = re.search(r'\\begin\{lstlisting\}.*?\](.*?)\\end\{lstlisting\}', block, re.DOTALL)
    return m.group(1).strip() if m else ''

def process_chapter(doc, tex_content, chap_num):
    # Chapter title
    m = re.search(r'\\chapter\{([^}]+)\}', tex_content)
    title = clean(m.group(1)) if m else f'Chapter {chap_num}'
    h = doc.add_heading(f'Chapter {chap_num}: {title}', level=1)
    for r in h.runs:
        r.font.color.rgb = RGBColor(31,78,121)
        r.font.name = 'Times New Roman'

    # Split into sections
    sections = re.split(r'\\section\{([^}]+)\}', tex_content)
    # First part is before any section (intro text)
    intro = sections[0]
    intro = re.sub(r'\\chapter\{[^}]+\}', '', intro).strip()
    intro_lines = [clean(l) for l in intro.split('\n') if l.strip() and not l.strip().startswith('%') and not l.strip().startswith('\\')]
    for l in intro_lines:
        if l: para(doc, l, align=WD_ALIGN_PARAGRAPH.JUSTIFY)

    # Process each section
    for i in range(1, len(sections), 2):
        sec_title = clean(sections[i])
        sec_body = sections[i+1] if i+1 < len(sections) else ''

        h2 = doc.add_heading(sec_title, level=2)
        for r in h2.runs:
            r.font.color.rgb = RGBColor(31,78,121)
            r.font.name = 'Times New Roman'

        # Subsections
        subsecs = re.split(r'\\subsection\{([^}]+)\}', sec_body)
        
        def process_block(block):
            # Tables
            table_blocks = re.findall(r'\\begin\{tabular[x]?\}.*?\\end\{tabular[x]?\}', block, re.DOTALL)
            captions = re.findall(r'\\caption\{([^}]+)\}', block)
            
            # Code blocks
            code_blocks = re.findall(r'\\begin\{lstlisting\}(.*?)\\end\{lstlisting\}', block, re.DOTALL)
            
            # Item lists
            item_blocks = re.findall(r'\\begin\{(itemize|enumerate)\}.*?((?:\\item.*?)+)\\end\{(?:itemize|enumerate)\}', block, re.DOTALL)
            
            # Remove special blocks for plain text extraction
            plain = block
            plain = re.sub(r'\\begin\{table\}.*?\\end\{table\}', '', plain, flags=re.DOTALL)
            plain = re.sub(r'\\begin\{figure\}.*?\\end\{figure\}', '', plain, flags=re.DOTALL)
            plain = re.sub(r'\\begin\{lstlisting\}.*?\\end\{lstlisting\}', '', plain, flags=re.DOTALL)
            plain = re.sub(r'\\begin\{(itemize|enumerate)\}.*?\\end\{(?:itemize|enumerate)\}', '', plain, flags=re.DOTALL)
            plain = re.sub(r'\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}', '', plain, flags=re.DOTALL)
            plain = re.sub(r'%.*', '', plain)
            plain = re.sub(r'\\noindent', '', plain)
            plain = re.sub(r'\\vspace\{[^}]+\}', '', plain)
            
            lines = [clean(l) for l in plain.split('\n') if l.strip()]
            for l in lines:
                if l and len(l) > 3: para(doc, l, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
            
            # Add itemized lists
            for list_type, items_block in item_blocks:
                items = parse_items(items_block + '\\end')
                for item in items:
                    if item:
                        p = doc.add_paragraph(style='List Bullet')
                        if ':' in item:
                            parts = item.split(':', 1)
                            r1 = p.add_run(parts[0] + ':')
                            r1.bold = True; r1.font.size = Pt(11); r1.font.name = 'Times New Roman'
                            r2 = p.add_run(parts[1])
                            r2.font.size = Pt(11); r2.font.name = 'Times New Roman'
                        else:
                            r = p.add_run(item)
                            r.font.size = Pt(11); r.font.name = 'Times New Roman'
            
            # Add tables
            for ti, tb in enumerate(table_blocks):
                hdrs, rows = parse_table_rows(tb)
                cap = clean(captions[ti]) if ti < len(captions) else None
                if hdrs and rows:
                    ncols = max(len(hdrs), max(len(r) for r in rows))
                    while len(hdrs) < ncols: hdrs.append('')
                    for r in rows:
                        while len(r) < ncols: r.append('')
                    make_table(doc, hdrs, rows, cap)
            
            # Add code
            for cb in code_blocks:
                cap_m = re.search(r'caption=\{([^}]+)\}', block)
                cap = clean(cap_m.group(1)) if cap_m else ''
                code_block(doc, cb.strip(), cap)

        # Process main subsection body
        main_body = subsecs[0]
        process_block(main_body)
        
        for si in range(1, len(subsecs), 2):
            sub_title = clean(subsecs[si])
            sub_body = subsecs[si+1] if si+1 < len(subsecs) else ''
            h3 = doc.add_heading(sub_title, level=3)
            for r in h3.runs:
                r.font.color.rgb = RGBColor(31,78,121)
                r.font.name = 'Times New Roman'
            process_block(sub_body)
    
    doc.add_page_break()

def main():
    doc = Document()
    
    # Page setup
    sec = doc.sections[0]
    sec.top_margin = Cm(2.5); sec.bottom_margin = Cm(2.5)
    sec.left_margin = Cm(3); sec.right_margin = Cm(2.5)
    add_borders(sec)

    # Default font
    style = doc.styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(12)

    # === COVER PAGE ===
    if os.path.exists(LOGO):
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(LOGO, width=Inches(2.2))
    
    para(doc, 'SMART HEALTHCARE MONITORING SYSTEM', sz=22, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), before=12)
    para(doc, 'Using IoT, Blockchain, and AI-Driven Analytics', sz=14, align=WD_ALIGN_PARAGRAPH.CENTER, color=(80,80,80), after=20)
    para(doc, 'PROJECT REPORT', sz=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), before=10, after=20)
    para(doc, 'Submitted By:', sz=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=8)
    for n, r in [('<Student Name 1>','<Roll No.>'),('<Student Name 2>','<Roll No.>'),('<Student Name 3>','<Roll No.>'),('<Student Name 4>','<Roll No.>')]:
        para(doc, f'{n}             Autonomy Roll: {r}', sz=12, align=WD_ALIGN_PARAGRAPH.CENTER, after=2)
    para(doc, 'Under the supervision of:', sz=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=12)
    para(doc, '<Guide Name>', sz=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, 'Department of Computer Science and Engineering\n(Internet of Things and Cyber Security including Block Chain Technology)', sz=11, align=WD_ALIGN_PARAGRAPH.CENTER, after=12)
    para(doc, 'In partial fulfilment for the award of the degree of:', sz=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=8)
    para(doc, 'BACHELOR OF TECHNOLOGY\nIn\nCOMPUTER SCIENCE AND ENGINEERING\n(INTERNET OF THINGS AND CYBER SECURITY\nINCLUDING BLOCK CHAIN TECHNOLOGY)', sz=12, align=WD_ALIGN_PARAGRAPH.CENTER, after=10)
    para(doc, 'HERITAGE INSTITUTE OF TECHNOLOGY, KOLKATA', sz=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=2)
    para(doc, 'MAULANA ABUL KALAM AZAD UNIVERSITY OF TECHNOLOGY, KOLKATA', sz=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=10)
    para(doc, 'MAY 2026', sz=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_page_break()

    # === CERTIFICATE ===
    if os.path.exists(LOGO):
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(LOGO, width=Inches(2.2))
    para(doc, 'HERITAGE INSTITUTE OF TECHNOLOGY, KOLKATA', sz=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), before=6)
    para(doc, 'MAULANA ABUL KALAM AZAD UNIVERSITY OF TECHNOLOGY', sz=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=20)
    para(doc, 'BONAFIDE CERTIFICATE', sz=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), before=10, after=20)
    para(doc, 'Certified that this project report on "Smart Healthcare Monitoring System Using IoT, Blockchain, and AI-Driven Analytics" is the bonafide work of "<Student Name 1>, <Student Name 2>, <Student Name 3>, <Student Name 4>" who carried out the project under my supervision.', sz=12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=40)
    t = doc.add_table(rows=2, cols=2)
    for j, (nm, rl) in enumerate([('Prof. (Dr.) Raja Karmakar\nHead of the Department\nCSE (IoT & Cyber Security incl. BCT)', 'Prof. <Guide Name>\nProject Guide\nCSE (IoT & Cyber Security incl. BCT)')]):
        for k, txt in enumerate(nm.split('|') if '|' in nm else [nm, rl]):
            c = t.rows[0].cells[k]; c.text = ''
            r = c.paragraphs[0].add_run(txt)
            r.font.size = Pt(11); r.font.name = 'Times New Roman'; r.bold = True
    para(doc, '', sz=20)
    para(doc, 'Examiner', sz=14, bold=True, before=20)
    para(doc, 'MAY, 2026', sz=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_page_break()

    # === ACKNOWLEDGEMENT ===
    para(doc, 'ACKNOWLEDGEMENT', sz=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), after=20)
    ack = read_tex('acknowledgement.tex')
    for line in ack.split('\n'):
        line = line.strip()
        if line and not line.startswith('\\') and not line.startswith('%'):
            para(doc, clean(line), align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=12)
    for nm in ['<Student Name 1>','<Student Name 2>','<Student Name 3>','<Student Name 4>']:
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = p.add_run(f'.............................\n{nm}')
        r.font.size = Pt(12); r.font.name = 'Times New Roman'
    doc.add_page_break()

    # === ABSTRACT ===
    para(doc, 'Abstract', sz=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), after=20)
    abstract = read_tex('abstract.tex')
    for line in abstract.split('\n'):
        line = line.strip()
        if line and not line.startswith('\\') and not line.startswith('%') and not line.startswith('{'):
            c = clean(line)
            if c and len(c) > 10: para(doc, c, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=10)
    doc.add_page_break()

    # === TABLE OF CONTENTS placeholder ===
    para(doc, 'TABLE OF CONTENTS', sz=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=(31,78,121), after=20)
    toc_items = [
        ('1', 'Introduction'), ('2', 'Related Works'), ('3', 'Limitations of Existing Models'),
        ('4', 'Methodology'), ('5', 'Dataset Details'), ('6', 'Flow Diagram'),
        ('7', 'Code Snippets'), ('8', 'Result Analysis'), ('9', 'Graphs & Outputs'),
        ('10', 'Present Limitations & Future Scope'), ('11', 'References')
    ]
    for num, title in toc_items:
        para(doc, f'Chapter {num}:  {title}', sz=12, after=4)
    doc.add_page_break()

    # === CHAPTERS ===
    chapter_files = [
        'ch01_introduction.tex', 'ch02_related_works.tex', 'ch03_limitations.tex',
        'ch04_methodology.tex', 'ch05_dataset.tex', 'ch06_flow_diagram.tex',
        'ch07_code_snippets.tex', 'ch08_result_analysis.tex', 'ch09_outputs.tex',
        'ch10_limitations_future.tex', 'ch11_references.tex'
    ]
    for idx, cf in enumerate(chapter_files, 1):
        tex = read_tex(cf)
        process_chapter(doc, tex, idx)

    # Add borders to all sections
    for sec in doc.sections:
        try: add_borders(sec)
        except: pass

    out = os.path.join(BASE, 'Smart_Healthcare_Project_Report.docx')
    doc.save(out)
    print(f'Report saved: {out}')

if __name__ == '__main__':
    main()
