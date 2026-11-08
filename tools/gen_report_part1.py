"""Part 1: Helper functions for Word report generation."""
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
import os

LOGO_PATH = os.path.join(os.path.dirname(__file__), 'template_image.jpeg')

def add_page_borders(section):
    """Add decorative page borders to a section."""
    sectPr = section._sectPr
    pgBorders = parse_xml(
        '<w:pgBorders {} w:offsetFrom="page">'
        '<w:top w:val="single" w:sz="12" w:space="24" w:color="1F4E79"/>'
        '<w:left w:val="single" w:sz="12" w:space="24" w:color="1F4E79"/>'
        '<w:bottom w:val="single" w:sz="12" w:space="24" w:color="1F4E79"/>'
        '<w:right w:val="single" w:sz="12" w:space="24" w:color="1F4E79"/>'
        '</w:pgBorders>'.format(nsdecls('w'))
    )
    sectPr.append(pgBorders)

def set_cell_shading(cell, color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}" w:val="clear"/>')
    tcPr.append(shading)

def add_formatted_para(doc, text, size=12, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, color=None, space_after=6, font_name='Times New Roman', space_before=0):
    p = doc.add_paragraph()
    p.alignment = align
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(space_before)
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = font_name
    if color:
        run.font.color.rgb = RGBColor(*color)
    return p

def add_heading_styled(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = RGBColor(31, 78, 121)
        run.font.name = 'Times New Roman'
    return h

def add_bullet_list(doc, items, bold_prefix=False):
    for item in items:
        p = doc.add_paragraph(style='List Bullet')
        if bold_prefix and ':' in item:
            parts = item.split(':', 1)
            run = p.add_run(parts[0] + ':')
            run.bold = True
            run.font.size = Pt(12)
            run.font.name = 'Times New Roman'
            run2 = p.add_run(parts[1])
            run2.font.size = Pt(12)
            run2.font.name = 'Times New Roman'
        else:
            run = p.add_run(item)
            run.font.size = Pt(12)
            run.font.name = 'Times New Roman'

def add_numbered_list(doc, items, bold_prefix=False):
    for item in items:
        p = doc.add_paragraph(style='List Number')
        if bold_prefix and ':' in item:
            parts = item.split(':', 1)
            run = p.add_run(parts[0] + ':')
            run.bold = True
            run.font.size = Pt(12)
            run.font.name = 'Times New Roman'
            run2 = p.add_run(parts[1])
            run2.font.size = Pt(12)
            run2.font.name = 'Times New Roman'
        else:
            run = p.add_run(item)
            run.font.size = Pt(12)
            run.font.name = 'Times New Roman'

def add_table(doc, headers, rows, caption=None):
    if caption:
        add_formatted_para(doc, caption, size=11, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=6)
    table = doc.add_table(rows=1+len(rows), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Header row
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ''
        p = cell.paragraphs[0]
        run = p.add_run(h)
        run.bold = True
        run.font.size = Pt(10)
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(cell, '1F4E79')
    # Data rows
    for r_idx, row in enumerate(rows):
        for c_idx, val in enumerate(row):
            cell = table.rows[r_idx+1].cells[c_idx]
            cell.text = ''
            p = cell.paragraphs[0]
            run = p.add_run(str(val))
            run.font.size = Pt(10)
            run.font.name = 'Times New Roman'
            if r_idx % 2 == 1:
                set_cell_shading(cell, 'D6E4F0')
    doc.add_paragraph()  # spacing
    return table

def add_code_block(doc, code, caption=''):
    if caption:
        add_formatted_para(doc, caption, size=10, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=6)
    for line in code.strip().split('\n'):
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.space_after = Pt(0)
        pf.space_before = Pt(0)
        pf.left_indent = Inches(0.3)
        run = p.add_run(line)
        run.font.size = Pt(9)
        run.font.name = 'Consolas'
        run.font.color.rgb = RGBColor(30, 30, 30)
        # Add background shading
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F5F5F5" w:val="clear"/>')
        p._p.get_or_add_pPr().append(shading)
    doc.add_paragraph()

def add_section_break(doc):
    """Add a section break (next page)."""
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    sectPr = parse_xml(f'<w:sectPr {nsdecls("w")}><w:type w:val="nextPage"/></w:sectPr>')
    pPr.append(sectPr)

def create_cover_page(doc):
    """Create the cover page with logo."""
    section = doc.sections[0]
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)
    add_page_borders(section)

    # Logo
    if os.path.exists(LOGO_PATH):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run()
        run.add_picture(LOGO_PATH, width=Inches(2.2))

    # Title
    add_formatted_para(doc, 'SMART HEALTHCARE MONITORING SYSTEM', size=22, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(31, 78, 121), space_before=12)
    add_formatted_para(doc, 'Using IoT, Blockchain, and AI-Driven Analytics', size=14,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(80, 80, 80), space_after=20)

    add_formatted_para(doc, 'PROJECT REPORT', size=18, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(31, 78, 121), space_before=10, space_after=20)

    add_formatted_para(doc, 'Submitted By:', size=14, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_after=8)

    students = [
        ('<Student Name 1>', '<Roll No.>'),
        ('<Student Name 2>', '<Roll No.>'),
        ('<Student Name 3>', '<Roll No.>'),
        ('<Student Name 4>', '<Roll No.>'),
    ]
    for name, roll in students:
        add_formatted_para(doc, f'{name}             Autonomy Roll: {roll}', size=12,
                           align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)

    add_formatted_para(doc, '', size=8)
    add_formatted_para(doc, 'Under the supervision of:', size=14, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10)
    add_formatted_para(doc, '<Guide Name>', size=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_formatted_para(doc, 'Department of Computer Science and Engineering\n(Internet of Things and Cyber Security including Block Chain Technology)',
                       size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    add_formatted_para(doc, 'In partial fulfilment for the award of the degree of:', size=13, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8)
    add_formatted_para(doc, 'BACHELOR OF TECHNOLOGY', size=14, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_formatted_para(doc, 'In\nCOMPUTER SCIENCE AND ENGINEERING\n(INTERNET OF THINGS AND CYBER SECURITY\nINCLUDING BLOCK CHAIN TECHNOLOGY)',
                       size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)
    add_formatted_para(doc, 'HERITAGE INSTITUTE OF TECHNOLOGY, KOLKATA', size=13, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_formatted_para(doc, 'MAULANA ABUL KALAM AZAD UNIVERSITY OF TECHNOLOGY, KOLKATA', size=12, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)
    add_formatted_para(doc, 'MAY 2026', size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_page_break()

def create_certificate_page(doc):
    """Create the certificate page with logo."""
    if os.path.exists(LOGO_PATH):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run()
        run.add_picture(LOGO_PATH, width=Inches(2.2))

    add_formatted_para(doc, 'HERITAGE INSTITUTE OF TECHNOLOGY, KOLKATA', size=16, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(31, 78, 121), space_before=6)
    add_formatted_para(doc, 'MAULANA ABUL KALAM AZAD UNIVERSITY OF TECHNOLOGY', size=12, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)
    add_formatted_para(doc, 'BONAFIDE CERTIFICATE', size=20, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(31, 78, 121), space_before=10, space_after=20)

    add_formatted_para(doc,
        'Certified that this project report on "Smart Healthcare Monitoring System Using IoT, Blockchain, and AI-Driven Analytics" '
        'is the bonafide work of "<Student Name 1>, <Student Name 2>, <Student Name 3>, <Student Name 4>" '
        'who carried out the project under my supervision.',
        size=12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=40)

    # Signature table
    table = doc.add_table(rows=3, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cells = [
        ('Prof. (Dr.) Raja Karmakar', 'Prof. <Guide Name>'),
        ('Head of the Department', 'Project Guide'),
        ('CSE (IoT & Cyber Security\nincluding Block Chain Technology)', 'CSE (IoT & Cyber Security\nincluding Block Chain Technology)'),
    ]
    for i, (left, right) in enumerate(cells):
        for j, txt in enumerate([left, right]):
            cell = table.rows[i].cells[j]
            cell.text = ''
            p = cell.paragraphs[0]
            run = p.add_run(txt)
            run.bold = (i == 0)
            run.font.size = Pt(11)
            run.font.name = 'Times New Roman'

    add_formatted_para(doc, '', size=20)
    add_formatted_para(doc, 'Examiner', size=14, bold=True, space_before=20)
    add_formatted_para(doc, '', size=12)
    add_formatted_para(doc, 'MAY, 2026', size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_page_break()

def create_acknowledgement(doc):
    add_formatted_para(doc, 'ACKNOWLEDGEMENT', size=20, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(31, 78, 121), space_after=20)
    texts = [
        'The satisfaction that accompanies the successful completion of any task would be incomplete without the mention of people whose ceaseless cooperation made it possible, whose constant guidance and encouragement crown all efforts with success.',
        'We would take this opportunity to thank our Principal, Professor Basab Chaudhuri, for allowing us to form a group of four people and for providing us with all necessary facilities to make our project work and of worth.',
        'We will be thankful to our Head of Department Prof. (Dr.) Raja Karmakar, for constantly supporting and giving us invaluable insights. His words of encouragement motivated us to achieve our goal and impetus to excel.',
        'We are grateful to our project guide Prof. <Guide Name> for the guidance, inspiration and constructive suggestion that helped us in the partial fulfilment for the award of the degree.',
    ]
    for t in texts:
        add_formatted_para(doc, t, size=12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=12)

    add_formatted_para(doc, '', size=20)
    for name in ['<Student Name 1>', '<Student Name 2>', '<Student Name 3>', '<Student Name 4>']:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run = p.add_run('.............................\n' + name)
        run.font.size = Pt(12)
        run.font.name = 'Times New Roman'
    doc.add_page_break()

def create_abstract(doc):
    add_formatted_para(doc, 'Abstract', size=20, bold=True,
                       align=WD_ALIGN_PARAGRAPH.CENTER, color=(31, 78, 121), space_after=20)
    paras = [
        'The Smart Healthcare Monitoring System is a comprehensive IoT-based platform designed to continuously monitor patient vital signs including heart rate, blood oxygen saturation (SpO2), and body temperature in real time. The system integrates hardware sensors (ESP32 microcontroller with MAX30102 pulse oximeter and DS18B20 temperature sensor) with a modern full-stack web application built on the MERN stack (MongoDB, Express.js, React 19, Node.js).',
        'The platform features a real-time dashboard powered by WebSocket communication (Socket.IO) that displays live patient vitals with interactive Chart.js visualizations. A robust Role-Based Access Control (RBAC) mechanism ensures secure, isolated data access across three user roles: patients (view own health data), doctors (monitor assigned patients), and administrators (full system oversight).',
        'Key features include an AI-powered health chatbot with 30+ intent detection capabilities, automated threshold-based alert generation for abnormal vital signs, AI-driven lab report analysis supporting 30+ medical tests with gender-aware reference ranges, secure file upload for medical reports, and comprehensive audit logging. The system employs JWT authentication with bcrypt password hashing for robust security.',
        'A Python-based IoT simulator mimics real sensor behavior using sinusoidal variation and Gaussian noise for testing. The hardware-agnostic REST API design allows seamless switching between simulated and real IoT devices. The project is designed as Phase 1 of a three-phase initiative, with future phases planned for Hyperledger Fabric blockchain integration and CNN-LSTM deep learning models for network intrusion detection.',
    ]
    for t in paras:
        add_formatted_para(doc, t, size=12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=10)

    add_formatted_para(doc, '', size=6)
    p = doc.add_paragraph()
    run = p.add_run('Keywords: ')
    run.bold = True
    run.font.size = Pt(12)
    run.font.name = 'Times New Roman'
    run2 = p.add_run('IoT, Healthcare Monitoring, MERN Stack, Real-Time Dashboard, WebSocket, Socket.IO, Role-Based Access Control, AI Chatbot, ESP32, MAX30102, DS18B20, Threshold-Based Alerts, JWT Authentication, MongoDB, React, Chart.js')
    run2.font.size = Pt(12)
    run2.font.name = 'Times New Roman'
    doc.add_page_break()
