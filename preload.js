// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
contextBridge.exposeInMainWorld('electronAPI', {
    // --- Two-way communication (Renderer invokes, Main handles and replies) ---

    /**
     * Saves a journal entry.
     * @param {string} dateStr - The date string (YYYY-MM-DD).
     * @param {string} content - The Markdown content of the entry.
     * @returns {Promise<object>} A promise that resolves with an object like { success: boolean, message?: string, error?: string }.
     */
    saveEntry: async (dateStr, content) => {
        return await ipcRenderer.invoke('save-entry', dateStr, content);
    },

    /**
     * Loads a journal entry.
     * @param {string} dateStr - The date string (YYYY-MM-DD).
     * @returns {Promise<object>} A promise that resolves with an object like { success: boolean, content?: string, message?: string, error?: string }.
     */
    loadEntry: async (dateStr) => {
        return await ipcRenderer.invoke('load-entry', dateStr);
    },

    /**
     * Compiles Markdown content to a PDF.
     * @param {string} dateStr - The date string (YYYY-MM-DD) for naming/context.
     * @param {string} mdContent - The Markdown content to compile.
     * @returns {Promise<object>} A promise that resolves with an object from the Python script,
     * e.g., { success: boolean, pdfPath?: string, log?: string, error?: string }.
     */
    compilePdf: async (dateStr, mdContent) => {
        return await ipcRenderer.invoke('compile-pdf', dateStr, mdContent);
    },

    // --- One-way communication (Renderer sends, Main listens) ---

    /**
     * Requests the main process to open a file in the system's default application.
     * @param {string} filePath - The absolute path to the file to open.
     */
    openFileInDefaultViewer: (filePath) => {
        ipcRenderer.send('open-file-in-default-viewer', filePath);
    }
});

console.log('Preload script has been loaded.'); // Optional: for debugging