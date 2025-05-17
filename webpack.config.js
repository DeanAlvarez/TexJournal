// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === 'development';

    return {
        mode: isDevelopment ? 'development' : 'production',
        entry: './src/renderer.js', // Your main renderer JavaScript file
        output: {
            path: path.resolve(__dirname, 'dist'), // Output directory for bundled files
            filename: 'bundle.js', // Name of the bundled JavaScript file
            globalObject: 'globalThis',
            // For Electron, ensuring paths are relative can be important.
            // publicPath is often fine as default or './'
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'], // Process CSS files
                },
                {
                    test: /\.ttf$/, // Monaco editor fonts
                    type: 'asset/resource'
                }
            ],
        },
        plugins: [
            new MonacoWebpackPlugin({
                // Available languages: 'apex', 'azcli', 'bat', 'c', 'clojure', 'coffeescript', 'cpp', 'csharp', 'csp',
                // 'css', 'dockerfile', 'fsharp', 'go', 'graphql', 'handlebars', 'html', 'ini', 'java', 'javascript',
                // 'json', 'kotlin', 'less', 'lua', 'markdown', 'msdax', 'mysql', 'objective-c', 'pascal', 'perl',
                // 'pgsql', 'php', 'plaintext', 'postiats', 'powerquery', 'powershell', 'pug', 'python', 'r', 'razor',
                // 'redis', 'redshift', 'restructuredtext', 'ruby', 'rust', 'sb', 'scala', 'scheme', 'scss', 'shell',
                // 'solidity', 'sophia', 'sql', 'st', 'swift', 'tcl', 'twig', 'typescript', 'vb', 'xml', 'yaml'
                languages: ['markdown', 'latex', 'css', 'html', 'json', 'javascript', 'typescript'], // Specify languages you need
                // For LaTeX, syntax highlighting will be basic without a custom Monarch tokenizer or TextMate grammar.
                // Consider this a starting point for LaTeX.
                features: ['!gotoSymbol'] // Example: disable a feature if not needed
            }),
            new HtmlWebpackPlugin({
                template: './src/index.html', // Path to your source HTML file
                filename: 'index.html'       // Name of the output HTML file in the dist directory
            }),
            new webpack.DefinePlugin({
                'global': 'globalThis' // Defines 'global' as an alias for 'globalThis' in the bundle
            }),
            new CopyWebpackPlugin({
                patterns: [
                    { 
                        from: 'node_modules/pdfjs-dist/build/pdf.worker.mjs', 
                        to: '.' // Copies to the root of the dist folder
                    }
                ]
            })
        ],
        // Recommended for development:
        devtool: isDevelopment ? 'eval-source-map' : 'source-map',

        // If you want to use webpack-dev-server for rapid frontend iteration (optional for Electron):
        // devServer: {
        //   static: {
        //     directory: path.join(__dirname, 'dist'),
        //   },
        //   compress: true,
        //   port: 9000, // Or any port you prefer
        //   hot: true, // Enable Hot Module Replacement
        // },

        // Target Electron renderer
        target: 'electron-renderer',

        // Node.js polyfills (might be needed for some libraries, but try to avoid if possible)
        // resolve: {
        //     fallback: {
        //         "path": require.resolve("path-browserify")
        //     }
        // }
    };
};