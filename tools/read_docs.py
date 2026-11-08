import docx
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = [
    'Smart_Healthcare_Final_Year_Project_Report.docx',
    'Chapter1_Chapter2_Expanded.docx',
    'Chapter2_Literature_Review_Expanded_Full.docx',
    'Chapter3_and_Chapter5_System_Architecture.docx',
    'Chapter4_Proposed_System.docx',
    'Chapter6_Hardware_Requirements.docx',
    'Chapter7_Software_Requirements.docx',
    'Chapter8_Security_and_Encryption.docx',
    'All_Required_Diagrams_and_Figures_List.docx',
    'Smart_Healthcare_Blockchain_Research_Report.docx',
    'Final_Project_Core_Diagrams.docx',
]

for f in files:
    path = os.path.join(r'd:\smart health care', f)
    if os.path.exists(path):
        doc = docx.Document(path)
        print(f'===== {f} =====')
        for p in doc.paragraphs:
            t = p.text.strip()
            if t:
                print(t)
        print()
