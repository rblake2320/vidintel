"""Export output content to Markdown and PDF formats."""

import io

from fpdf import FPDF


def to_markdown(content: str) -> bytes:
    """Return the raw Markdown content as UTF-8 bytes."""
    return content.encode("utf-8")


def to_pdf(content: str) -> bytes:
    """Convert Markdown content to a PDF document using fpdf2."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)

    # Process line by line for basic formatting
    for line in content.split("\n"):
        stripped = line.strip()

        if stripped.startswith("## "):
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 10, stripped[3:], new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", size=10)
        elif stripped.startswith("### "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, stripped[4:], new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", size=10)
        elif stripped.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 12, stripped[2:], new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", size=10)
        elif stripped.startswith("- ") or stripped.startswith("* "):
            pdf.cell(10)
            pdf.multi_cell(0, 6, stripped, new_x="LMARGIN", new_y="NEXT")
        elif stripped.startswith("**") and stripped.endswith("**"):
            pdf.set_font("Helvetica", "B", 10)
            pdf.multi_cell(0, 6, stripped.strip("*"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", size=10)
        elif stripped == "":
            pdf.ln(4)
        else:
            pdf.multi_cell(0, 6, stripped, new_x="LMARGIN", new_y="NEXT")

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
