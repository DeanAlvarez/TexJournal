// src/editor.js
import * as monaco from 'monaco-editor';
import latexLanguageDefinition from './syntax/latex.json'; // Import the JSON file

let editorInstance;

// --- Setup LaTeX Language Support ---
// 1. Register the language with Monaco
monaco.languages.register({
    id: 'latex',
    extensions: latexLanguageDefinition.fileExtensions || ['.tex', '.sty', '.cls'],
    aliases: [latexLanguageDefinition.displayName || 'LaTeX', 'latex', 'tex'],
    mimetypes: latexLanguageDefinition.mimeTypes || ['text/latex', 'text/tex'],
});

// 2. Set the Monarch tokens provider (syntax highlighting rules)
// The `latexLanguageDefinition` object from the JSON directly fits the Monarch provider structure.
// The rule "$1@builtin" in the tokenizer will look for a top-level array named "builtin"
// in this object, which your JSON provides.
monaco.languages.setMonarchTokensProvider('latex', latexLanguageDefinition);

// 3. Set the language configuration (comments, brackets, etc.)
const latexLanguageConfiguration = {
    comments: {
        lineComment: latexLanguageDefinition.lineComment || '%' // Default to '%' if not in JSON
    },
    brackets: [
        ['{', '}'], ['[', ']'], ['(', ')']
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        // For LaTeX, $...$ for inline math is common
        // This rule tries to add it if not inside a string or comment
        { open: '$', close: '$', notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '$', close: '$' }
    ],
    // It's good practice to define word patterns for better word-based operations
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\#\%\^\&\*\(\)\-\=\+\[\{\]\}\ liturg|\'\;\:\.\,\<\>\/\?\s]+)/g,
    // Indentation rules can be complex for LaTeX, starting simple or omitting for now
    // indentationRules: { ... }
};
monaco.languages.setLanguageConfiguration('latex', latexLanguageConfiguration);

// --- Monaco Environment for Workers ---
// It's crucial that MonacoEnvironment is set up globally *before* the first editor instance is created.
self.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        // These paths are relative to your `dist` folder after Webpack bundling
        // Ensure these filenames match what monaco-editor-webpack-plugin outputs
        if (label === 'json') return './json.worker.bundle.js';
        if (label === 'css' || label === 'scss' || label === 'less') return './css.worker.bundle.js';
        if (label === 'html' || label === 'handlebars' || label === 'razor') return './html.worker.bundle.js';
        if (label === 'typescript' || label === 'javascript') return './ts.worker.bundle.js';
        return './editor.worker.bundle.js'; // Default worker for other features
    }
};

// --- Editor Initialization and Control Functions ---
export function initEditor(containerId, initialContent = '', language = 'latex') { // Default to latex now
    const editorContainer = document.getElementById(containerId);
    if (!editorContainer) {
        console.error(`Editor container with ID '${containerId}' not found.`);
        return null;
    }

    if (typeof monaco === 'undefined' || typeof monaco.editor === 'undefined') {
        console.error("Monaco Editor main library (monaco or monaco.editor) is not loaded. Check Webpack configuration and imports.");
        return null;
    }

    try {
        editorInstance = monaco.editor.create(editorContainer, {
            value: initialContent,
            language: language, // Ensure this is 'latex'
            theme: 'vs-dark',
            automaticLayout: true,
            wordWrap: 'on',
            minimap: {
                enabled: true,
            },
            scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
            },
        });
        console.log("Monaco Editor initialized with LaTeX language support.");
    } catch (error) {
        console.error("Error creating Monaco Editor instance:", error);
        return null;
    }
    return editorInstance;
}

export function getEditorContent() {
    if (!editorInstance) {
        console.warn("getEditorContent called before editor initialization or after disposal.");
        return '';
    }
    return editorInstance.getValue();
}

export function setEditorContent(text) {
    if (!editorInstance) {
        console.warn("setEditorContent called before editor initialization or after disposal.");
        return;
    }
    editorInstance.setValue(text);
}

export function getEditorInstance() {
    return editorInstance;
}