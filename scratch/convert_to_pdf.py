import subprocess
import os

html_path = os.path.abspath(r"d:\smart health care\COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.html")
pdf_path = os.path.abspath(r"d:\smart health care\COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.pdf")

chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

exe = chrome_exe if os.path.exists(chrome_exe) else edge_exe

cmd = [
    exe,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    f"file:///{html_path}"
]

print(f"Executing: {' '.join(cmd)}")
res = subprocess.run(cmd, capture_output=True, text=True)
print(f"Return code: {res.returncode}")
print(f"Stdout: {res.stdout}")
print(f"Stderr: {res.stderr}")

if os.path.exists(pdf_path):
    size = os.path.getsize(pdf_path)
    print(f"SUCCESS: PDF generated at: {pdf_path}")
    print(f"File size: {size} bytes ({size / 1024:.2f} KB)")
else:
    print("ERROR: PDF was not generated.")

# Clean up temporary test output if it exists
if os.path.exists(r"D:\output.pdf"):
    try:
        os.remove(r"D:\output.pdf")
    except Exception:
        pass
