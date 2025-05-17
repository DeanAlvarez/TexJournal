// main.js
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises; // Using promises version for async operations
const fsSync = require('fs'); // For initial synchronous directory creation
const { PythonShell } = require('python-shell');

// Needed due to bum WSL based dev
app.disableHardwareAcceleration();

// --- Global variable for the main window ---
let mainWindow;

// --- Define paths ---
const journalEntriesDir = path.join(__dirname, 'journal_entries');
const outputFilesDir = path.join(__dirname, 'output_files');
const assetsDir = path.join(__dirname, 'assets');
const pythonScriptsDir = path.join(__dirname, 'python_scripts');

// --- Ensure necessary directories exist ---
function ensureDirectoriesExist() {
    try {
        if (!fsSync.existsSync(journalEntriesDir)) {
            fsSync.mkdirSync(journalEntriesDir, { recursive: true });
            console.log(`Created directory: ${journalEntriesDir}`);
        }
        if (!fsSync.existsSync(outputFilesDir)) {
            fsSync.mkdirSync(outputFilesDir, { recursive: true });
            console.log(`Created directory: ${outputFilesDir}`);
        }
        // assets and python_scripts should exist as part of your project structure
    } catch (error) {
        console.error('Failed to create essential directories:', error);
        // Consider quitting the app or showing a dialog if essential dirs can't be made
        dialog.showErrorBox("Initialization Error", "Could not create necessary application directories. Please check permissions.");
        app.quit();
    }
}


// --- Create the browser window ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, // Adjust as needed
        height: 900, // Adjust as needed
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, // Recommended for security
            nodeIntegration: false, // Recommended for security
            // webSecurity: true, // Default, good for security
            // allowRunningInsecureContent: false // Default
        },
    });

    // Load the index.html from your Webpack's 'dist' folder
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

    // Open the DevTools (optional, for debugging)
    if (process.env.NODE_ENV !== 'production') { // Only open dev tools if not in production
        mainWindow.webContents.openDevTools();
    }


    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- App lifecycle event handlers ---
app.whenReady().then(() => {
    ensureDirectoriesExist(); // Create directories before the window
    createWindow();

    app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Quit when all windows are closed, except on macOS.
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers (communication with renderer process) ---

// Handle saving an entry
ipcMain.handle('save-entry', async (event, dateStr, content) => {
    if (!dateStr || typeof content !== 'string') {
        return { success: false, error: 'Invalid input for saving entry.' };
    }
    const filePath = path.join(journalEntriesDir, `${dateStr}.md`);
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { success: true, message: `Entry saved to ${filePath}` };
    } catch (error) {
        console.error('Failed to save entry:', error);
        return { success: false, error: `Failed to save entry: ${error.message}` };
    }
});

// Handle loading an entry
ipcMain.handle('load-entry', async (event, dateStr) => {
    if (!dateStr) {
        return { success: false, error: 'Invalid date for loading entry.' };
    }
    const filePath = path.join(journalEntriesDir, `${dateStr}.md`);
    try {
        if (fsSync.existsSync(filePath)) { // Check existence synchronously before async read
            const content = await fs.readFile(filePath, 'utf8');
            return { success: true, content: content };
        } else {
            return { success: true, content: '', message: 'No entry found for this date.' }; // No error, just no content
        }
    } catch (error) {
        console.error('Failed to load entry:', error);
        return { success: false, error: `Failed to load entry: ${error.message}`, content: '' };
    }
});

// Handle compiling Markdown to PDF via Python
ipcMain.handle('compile-pdf', async (event, dateStr, latexContent) => {
    if (!dateStr || typeof latexContent !== 'string') {
        return { success: false, error: 'Invalid input for PDF compilation.' };
    }

    const options = {
        mode: 'json', // Expect JSON output from Python script
        pythonPath: 'python3', // Or 'python'. Specify full path if not in system PATH.
                               // On Windows, python-shell might find it automatically if Python installed correctly.
        scriptPath: pythonScriptsDir,
        args: [
            latexContent,
            dateStr,
            path.join(assetsDir, 'latex_template.tex'), // Path to your LaTeX template
            outputFilesDir  // Directory where Python script should save .tex and .pdf
        ]
    };

    try {
        console.log(`Running Python script 'compile_latex.py' with date: ${dateStr}`);
        const results = await PythonShell.run('compile_latex.py', options);
        // python-shell in JSON mode returns an array of JSON objects if Python prints multiple JSON lines.
        // Assuming your Python script prints a single JSON object to stdout.
        if (results && results.length > 0) {
            console.log('Python script output:', results[0]);
            // Construct absolute path for the PDF if Python script returns a relative one
            // Assuming python script returns a field like 'pdfFileName' relative to outputFilesDir
            if (results[0].success && results[0].pdfFileName) {
                 results[0].pdfPath = path.join(outputFilesDir, results[0].pdfFileName);
            } else if (results[0].success && results[0].pdfPath) {
                // if python script already provides an absolute or suitable path
                 console.log("Python script provided pdfPath:", results[0].pdfPath);
            }
            return results[0]; // This should be the JSON object { success: true/false, pdfPath: '...', log: '...' }
        }
        return { success: false, error: 'Python script did not return expected output.' };
    } catch (error) {
        console.error('Error running Python script:', error);
        return {
            success: false,
            error: `Python script execution failed: ${error.message}`,
            // stdout: error.stdout, // python-shell error object might have these
            // stderr: error.stderr
        };
    }
});


// (Optional) Handle opening a file in the default system viewer
ipcMain.on('open-file-in-default-viewer', (event, filePath) => {
    if (!filePath || !fsSync.existsSync(filePath)) {
        console.error(`File not found, cannot open: ${filePath}`);
        dialog.showErrorBox("File Error", `Could not find file to open: ${filePath}`);
        return;
    }
    shell.openPath(filePath)
        .catch(err => {
            console.error(`Failed to open path ${filePath}:`, err);
            dialog.showErrorBox("Open File Error", `Could not open file: ${err.message}`);
        });
});