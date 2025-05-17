# python_scripts/compile_latex.py
import sys
import os
import subprocess
import json
import argparse
import re # Still needed for escape_latex_special_chars

def escape_latex_special_chars(text):
    """
    Escapes LaTeX special characters in a given plain text string.
    This should be used for content like dates if inserted as plain text,
    NOT for user-supplied LaTeX content.
    """
    if not isinstance(text, str):
        return text

    conv = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
        '\\': r'\textbackslash{}', # Must be before other backslash commands if not using regex lookahead
        '<': r'\textless{}',
        '>': r'\textgreater{}',
    }
    # Regex to avoid double-escaping and to handle backslash correctly
    # This will find any of the special characters to be escaped.
    regex = re.compile('|'.join(re.escape(str(key)) for key in sorted(conv.keys(), key = len, reverse = True)))
    return regex.sub(lambda match: conv[match.group(0)], text)

def main():
    parser = argparse.ArgumentParser(description="Compile LaTeX content to PDF.")
    parser.add_argument("latex_content", help="LaTeX content string for the journal body.")
    parser.add_argument("date_str", help="Date string for the entry (e.g., YYYY-MM-DD).")
    parser.add_argument("template_path", help="Path to the LaTeX template file.")
    parser.add_argument("output_dir", help="Directory to save .tex and .pdf files.")
    
    args = parser.parse_args()

    output = {"success": False, "pdfFileName": None, "log": "", "error": ""}

    try:
        # 1. User-provided content is now assumed to be LaTeX.
        # No Markdown-to-HTML or HTML-to-LaTeX conversion needed.
        latex_body = args.latex_content

        # 2. Read LaTeX template
        with open(args.template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        # 3. Populate template
        # Escape the date string as it's inserted as plain text into a LaTeX command argument context.
        # The main latex_body is assumed to be valid LaTeX and is NOT escaped here.
        final_latex_content = template_content.replace("%%DATE%%", escape_latex_special_chars(args.date_str))
        final_latex_content = final_latex_content.replace("%%CONTENT%%", latex_body)

        # 4. Write .tex file
        tex_base_name = args.date_str # e.g., "2023-10-26"
        tex_file_path = os.path.join(args.output_dir, f"{tex_base_name}.tex")
        pdf_file_name = f"{tex_base_name}.pdf" # Name for main.js to find

        with open(tex_file_path, 'w', encoding='utf-8') as f:
            f.write(final_latex_content)

        # 5. Run pdflatex
        process_args = [
            "pdflatex",
            "-interaction=nonstopmode",
            "-output-directory=" + args.output_dir, # Ensure pdflatex writes output here
            "-jobname=" + tex_base_name, # Ensures log/aux files use this base name and are in output_dir
            tex_file_path # The input .tex file
        ]
        
        log_output = ""
        compilation_success = False
        # Run pdflatex twice for robustness (e.g., if template ever uses complex refs/toc)
        for i in range(2): 
            process = subprocess.run(process_args, capture_output=True, text=True, encoding='utf-8', errors='replace')
            log_output += f"--- Pass {i+1} ---\nSTDOUT:\n{process.stdout}\nSTDERR:\n{process.stderr}\n"
            
            # Check if PDF was created in this pass (more reliable check)
            pdf_expected_path = os.path.join(args.output_dir, pdf_file_name)

            if process.returncode == 0 and os.path.exists(pdf_expected_path):
                compilation_success = True
                # If the first pass was successful and created a PDF,
                # a second pass is good for references. If the second pass also works, great.
                # No need to break if successful, let the second pass run.
            else:
                compilation_success = False # If any pass fails to produce PDF or errors, mark as failure
                output["error"] = f"pdflatex compilation failed on pass {i+1} or PDF not found."
                if process.returncode != 0:
                     output["error"] += f" pdflatex exit code: {process.returncode}."
                break # Stop if a pass fails significantly

        output["log"] = log_output

        # 6. Final check for PDF and set success status
        if compilation_success: # This is true if the last successful pass produced a PDF
            output["success"] = True
            output["pdfFileName"] = pdf_file_name
        # If compilation_success is false, error messages would have been set in the loop


    except Exception as e:
        output["success"] = False
        output["error"] = f"Python script error: {str(e)}"
        import traceback
        output["log"] = output.get("log","") + "\nPython Traceback:\n" + traceback.format_exc()

    # 7. Print JSON output
    print(json.dumps(output))

if __name__ == "__main__":
    main()