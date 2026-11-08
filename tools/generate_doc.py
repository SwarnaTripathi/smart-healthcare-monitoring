"""
Convert PROJECT_DOCUMENTATION.md to a styled HTML file
that can be printed/saved as PDF from any browser
"""

import re, os

md_path = r"d:\smart health care\PROJECT_DOCUMENTATION.md"
html_path = r"d:\smart health care\PROJECT_DOCUMENTATION.html"

with open(md_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Basic markdown to HTML conversion
def md_to_html(text):
    lines = text.split('\n')
    html_lines = []
    in_code = False
    in_table = False
    in_list = False
    code_lang = ''
    
    for line in lines:
        # Code blocks
        if line.strip().startswith('```'):
            if in_code:
                html_lines.append('</code></pre>')
                in_code = False
            else:
                lang = line.strip().replace('```', '')
                html_lines.append(f'<pre class="code-block"><code>')
                in_code = True
            continue
        if in_code:
            html_lines.append(line.replace('<', '&lt;').replace('>', '&gt;'))
            continue
        
        # Close list if not continuing
        if in_list and not line.strip().startswith(('- ', '* ', '| ')):
            if not line.strip().startswith(('- ', '* ')):
                in_list = False
        
        # Tables
        if '|' in line and line.strip().startswith('|'):
            cells = [c.strip() for c in line.strip().split('|')[1:-1]]
            if all(set(c) <= set('- :') for c in cells):
                continue  # Skip separator row
            if not in_table:
                html_lines.append('<div class="table-wrap"><table>')
                in_table = True
                html_lines.append('<thead><tr>' + ''.join(f'<th>{c}</th>' for c in cells) + '</tr></thead><tbody>')
            else:
                html_lines.append('<tr>' + ''.join(f'<td>{format_inline(c)}</td>' for c in cells) + '</tr>')
            continue
        elif in_table:
            html_lines.append('</tbody></table></div>')
            in_table = False
        
        # Headings
        if line.startswith('# '):
            html_lines.append(f'<h1>{format_inline(line[2:])}</h1>')
        elif line.startswith('## '):
            html_lines.append(f'<h2>{format_inline(line[3:])}</h2>')
        elif line.startswith('### '):
            html_lines.append(f'<h3>{format_inline(line[4:])}</h3>')
        elif line.startswith('---'):
            html_lines.append('<hr>')
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            txt = line.strip()[2:]
            html_lines.append(f'<li>{format_inline(txt)}</li>')
        elif line.strip() == '':
            html_lines.append('<br>')
        else:
            html_lines.append(f'<p>{format_inline(line)}</p>')
    
    if in_table:
        html_lines.append('</tbody></table></div>')
    
    return '\n'.join(html_lines)

def format_inline(text):
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'`([^`]+)`', r'<code class="inline">\1</code>', text)
    text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
    return text

body = md_to_html(content)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Smart Healthcare Monitoring System — Project Documentation</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
    font-family: 'Inter', sans-serif;
    background: #f8fafc;
    color: #1e293b;
    line-height: 1.8;
    padding: 40px;
    max-width: 900px;
    margin: 0 auto;
}}
h1 {{
    font-size: 1.8rem;
    font-weight: 800;
    color: #0f172a;
    margin: 40px 0 16px;
    padding-bottom: 8px;
    border-bottom: 3px solid #06d6a0;
}}
h2 {{
    font-size: 1.35rem;
    font-weight: 700;
    color: #0f172a;
    margin: 32px 0 12px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #ecfdf5, #f0f9ff);
    border-left: 4px solid #06d6a0;
    border-radius: 0 8px 8px 0;
}}
h3 {{
    font-size: 1.05rem;
    font-weight: 600;
    color: #334155;
    margin: 24px 0 8px;
}}
p {{ margin: 6px 0; font-size: 0.92rem; }}
li {{ margin: 4px 0 4px 24px; font-size: 0.9rem; }}
hr {{ border: none; border-top: 2px solid #e2e8f0; margin: 32px 0; }}
br {{ display: block; margin: 4px 0; }}
.code-block {{
    background: #1e293b;
    color: #e2e8f0;
    padding: 16px 20px;
    border-radius: 10px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 0.82rem;
    line-height: 1.6;
    overflow-x: auto;
    margin: 12px 0;
    white-space: pre;
}}
code.inline {{
    background: #e2e8f0;
    padding: 2px 7px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 0.85em;
    color: #0f766e;
}}
.table-wrap {{ overflow-x: auto; margin: 12px 0; }}
table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    margin: 8px 0;
}}
th {{
    background: #0f172a;
    color: white;
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 0.8rem;
}}
td {{
    padding: 9px 14px;
    border-bottom: 1px solid #e2e8f0;
}}
tr:nth-child(even) {{ background: #f8fafc; }}
tr:hover {{ background: #ecfdf5; }}
strong {{ color: #0f172a; }}

/* Print styles */
@media print {{
    body {{ padding: 20px; font-size: 11pt; }}
    h1 {{ font-size: 16pt; page-break-before: always; }}
    h1:first-of-type {{ page-break-before: avoid; }}
    h2 {{ font-size: 13pt; }}
    .code-block {{ font-size: 9pt; }}
    table {{ font-size: 9pt; }}
}}

/* Title page styling */
h1:first-of-type {{
    font-size: 2.2rem;
    text-align: center;
    border-bottom: none;
    margin-top: 60px;
    background: linear-gradient(135deg, #06d6a0, #4cc9f0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}}
h2:first-of-type {{
    text-align: center;
    background: none;
    border-left: none;
    color: #64748b;
    font-weight: 500;
    font-size: 1rem;
}}
</style>
</head>
<body>
{body}
<div style="margin-top:40px; text-align:center; color:#94a3b8; font-size:0.8rem;">
<hr>
<p>Smart Healthcare Monitoring System — Phase 1 Documentation</p>
<p>Generated: May 2026 | To save as PDF: Press Ctrl+P → Save as PDF</p>
</div>
</body>
</html>"""

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"HTML generated: {html_path}")
print("Open in browser and press Ctrl+P to save as PDF")
