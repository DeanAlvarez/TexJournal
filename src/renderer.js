// src/renderer.js
import './style.css'; // Import your CSS for Webpack to bundle

// Import the functions from your actual editor.js module
import { initEditor, getEditorContent, setEditorContent } from './editor.js';

import * as pdfjsLib from 'pdfjs-dist'; //import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';


document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('entry-date');
    const loadButton = document.getElementById('load-entry');
    const saveButton = document.getElementById('save-entry');
    const compileButton = document.getElementById('compile-pdf');
    const statusMessageElement = document.getElementById('status-message');

    const pdfViewerContainer = document.getElementById('pdf-viewer-container');

    // Initialize the Monaco Editor using the imported function
    const editor = initEditor('editor-container'); // Pass the ID of your editor container div

    // Crucially, check if the editor initialized successfully
    if (!editor) {
        displayStatus("CRITICAL: Editor could not be initialized. The application may not work correctly.", "error");
        // You might want to disable UI elements that depend on the editor here
        loadButton.disabled = true;
        saveButton.disabled = true;
        compileButton.disabled = true;
        return; // Stop further execution if editor fails
    }

    function displayStatus(message, type = 'info') { // type can be 'info', 'success', 'error'
        statusMessageElement.textContent = message;
        // Ensure your CSS has .status-info, .status-success, .status-error classes
        statusMessageElement.className = `status-message status-${type}`;
        console.log(`Status (${type}): ${message}`);
    }

    async function loadEntryForDate(dateStr) {
        if (!dateStr) {
            displayStatus('Please select a valid date.', 'error');
            return;
        }
        displayStatus(`Loading entry for ${dateStr}...`, 'info');
        try {
            const result = await window.electronAPI.loadEntry(dateStr);
            if (result.success) {
                // Use the imported setEditorContent
                setEditorContent(result.content || '');
                displayStatus(result.message || `Entry for ${dateStr} loaded.`, 'success');
                // Clear the PDF.js
                if (pdfViewerContainer) {
                    pdfViewerContainer.innerHTML = ''; 
                }
            } else {
                setEditorContent(''); // Clear editor if entry not found or error
                displayStatus(`Error loading entry: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            setEditorContent('');
            displayStatus(`Failed to communicate with main process for loading: ${error.message}`, 'error');
            console.error("IPC Load Error:", error);
        }
    }

    // --- Event Listeners ---
    dateInput.addEventListener('change', () => {
        loadEntryForDate(dateInput.value);
    });

    loadButton.addEventListener('click', () => {
        const dateStr = dateInput.value;
        if (dateStr) {
            loadEntryForDate(dateStr);
        } else {
            displayStatus('Please select a date to load.', 'error');
        }
    });

    saveButton.addEventListener('click', async () => {
        const dateStr = dateInput.value;
        // Use the imported getEditorContent
        const content = getEditorContent();
        if (!dateStr) {
            displayStatus('Please select a date to save.', 'error');
            return;
        }
        displayStatus(`Saving entry for ${dateStr}...`, 'info');
        try {
            const result = await window.electronAPI.saveEntry(dateStr, content);
            if (result.success) {
                displayStatus(result.message || 'Entry saved successfully!', 'success');
            } else {
                displayStatus(`Error saving entry: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            displayStatus(`Failed to communicate with main process for saving: ${error.message}`, 'error');
            console.error("IPC Save Error:", error);
        }
    });

    compileButton.addEventListener('click', async () => {
        const dateStr = dateInput.value;
        // Use the imported getEditorContent
        const latexContent = getEditorContent();

        if (!dateStr) {
            displayStatus('Please select a date for the entry.', 'error');
            return;
        }
        if (!latexContent.trim()) {
            displayStatus('Entry content is empty. Nothing to compile.', 'info');
            return;
        }

        displayStatus(`Compiling PDF for ${dateStr}... This may take a moment.`, 'info');
        // Clear the PDF.js container
        if (pdfViewerContainer) {
            pdfViewerContainer.innerHTML = ''; // <--- MODIFIED LINE
        }

        try {
            const result = await window.electronAPI.compilePdf(dateStr, latexContent);
            if (result.success && result.pdfPath) {
                displayStatus('PDF compiled, loading preview...', 'info');
                loadPdfWithPdfJs(result.pdfPath);
            } else {
                displayStatus(`PDF Compilation Failed: ${result.error || 'Unknown error'}. Check console for logs.`, 'error');
                console.error("Compilation Error:", result.error);
                console.error("Compilation Log:", result.log);
            }
        } catch (error) {
            displayStatus(`Failed to communicate with main process for PDF compilation: ${error.message}`, 'error');
            console.error("IPC Compile Error:", error);
        }
    });

    async function loadPdfWithPdfJs(pdfPath) {
        const pdfViewerContainer = document.getElementById('pdf-viewer-container');
        pdfViewerContainer.innerHTML = ''; // Clear previous PDF pages
    
        // For local files in Electron, PDF.js needs the data as a URL or ArrayBuffer.
        // Using the file path directly might require converting it to a file:// URL
        // or reading the file content in main process and sending ArrayBuffer via IPC.
        // For simplicity, let's assume main process can provide a data URL or ArrayBuffer,
        // or we construct a file:// URL that PDF.js can handle in Electron.
    
        const pdfUrl = `file://${pdfPath}`; // `pdfPath` is absolute path from main process
    
        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            displayStatus(`PDF loaded. Rendering ${pdf.numPages} pages...`, 'info');
    
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale as needed
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.classList.add('page'); // For styling
                pdfViewerContainer.appendChild(canvas);

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;
            }
            displayStatus('PDF rendered successfully!', 'success');
        } catch (error) {
            console.error('Error loading/rendering PDF with PDF.js:', error);
            displayStatus(`Failed to render PDF: ${error.message}`, 'error');
        }
    }

    // --- Initial Load ---
    function getFormattedDate(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const todayStr = getFormattedDate(new Date());
    dateInput.value = todayStr;
    // Ensure editor is ready before trying to load into it
    if (editor) {
        loadEntryForDate(todayStr);
    }
});