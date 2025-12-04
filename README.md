# Extension Bridge

> Find Firefox alternatives for your Chrome extensions with intelligent matching

[![Version](https://img.shields.io/badge/version-3.3.0-blue.svg)](https://github.com/michaelnyc17/extension-bridge)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Install-brightgreen.svg)](https://chrome.google.com/webstore)

## 🌉 About

Extension Bridge is a Chrome extension that helps users transitioning to Firefox by automatically finding Firefox alternatives for their installed Chrome extensions. Using intelligent matching algorithms and real-time API data from Mozilla's Firefox Add-ons repository, it provides:

- **Smart Matching**: Finds exact and similar alternatives based on name, description, and functionality
- **Export Options**: Export your matches in multiple formats (CSV, JSON, HTML, Text)
- **Comparison View**: Side-by-side comparison of Chrome extensions vs Firefox alternatives
- **Portability Analysis**: Assess how easily each extension can be replaced

## ✨ Features

### Core Functionality
- 🔍 **Automatic Scanning**: Scans all installed Chrome extensions
- 🎯 **Intelligent Matching**: Uses advanced algorithms to find Firefox alternatives
- 📊 **Match Scoring**: Displays confidence scores for each match
- 🏷️ **Categorization**: Exact matches, similar matches, and no matches

### Export & Sharing
- 📄 **Text Export**: Simple URL list
- 📊 **CSV Export**: Spreadsheet-friendly format with detailed information
- 💾 **JSON Export**: Structured data for developers
- 🌐 **HTML Report**: Beautiful, shareable report with statistics

### User Experience
- 🔍 **Comparison Modal**: Detailed side-by-side comparison
- 🎨 **Modern UI**: Clean, Apple-inspired design
- 🌓 **Dark Mode**: Full dark theme support
- 💾 **Smart Caching**: Fast results with 24-hour cache
- 🔔 **Notifications**: Get notified about better matches for ignored extensions

## 📸 Screenshots

![Extension Bridge Welcome Screen](screenshots/welcome.png)
![Main Interface](screenshots/main.png)
![Comparison View](screenshots/comparison.png)
![Export Options](screenshots/export.png)

## 🚀 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store page](#)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Development)
1. Download the latest release
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## 📖 Usage

1. **Initial Scan**: Click "Scan Extensions" to analyze your installed Chrome extensions
2. **Review Matches**: Browse through exact and similar matches
3. **Compare**: Click "Compare" to see detailed side-by-side information
4. **Export**: Use the export dropdown to save your matches in various formats
5. **Install**: Click on Firefox addon links to install alternatives

## 🔧 Technical Details

### Built With
- **Manifest V3**: Latest Chrome extension API
- **Vanilla JavaScript**: No framework dependencies
- **Mozilla Add-ons API**: Real-time Firefox addon data
- **Chrome Management API**: Access to installed extensions

### Architecture
```
ExtensionBridge/
├── popup.html          # Main UI
├── popup.js            # Core logic & UI orchestration
├── styles.css          # Styling (Apple-inspired design)
├── matcher.js          # Matching algorithm
├── portability.js      # Portability analysis
└── manifest.json       # Extension configuration
```

### Matching Algorithm
The extension uses a sophisticated scoring system that considers:
- Name similarity (Levenshtein distance)
- Description matching
- Developer/publisher matching
- Homepage URL comparison
- Keyword overlap

## 🛡️ Privacy & Security

- **No Data Collection**: Your extension data never leaves your browser
- **Local Storage Only**: Results cached locally for performance
- **No Tracking**: No analytics or user tracking
- **Mozilla API Only**: Only fetches public data from Firefox Add-ons API

## 📋 Permissions

The extension requires:
- `management`: To read your installed Chrome extensions
- `storage`: To cache results locally
- `https://addons.mozilla.org/*`: To fetch Firefox addon data

## 🤝 Contributing

**Note**: This is source-available software. The code is viewable for educational purposes, but copying, modification, and redistribution are not permitted. See [LICENSE](./LICENSE) for details.

If you'd like to contribute or suggest features, please open an issue.

## 📜 License

Copyright (c) 2025 ExtensionBridge. All Rights Reserved.

This software is source-available for viewing purposes only. See [LICENSE](./LICENSE) for full details.

## 🐛 Bug Reports & Feature Requests

Found a bug or have a feature request? Please [open an issue](https://github.com/yourusername/extension-bridge/issues).

## 📧 Contact

For licensing inquiries or questions:
- Email: kommeymichael1@gmail.com

## 🙏 Acknowledgments

- Firefox Add-ons API for providing addon data
- Chrome Extensions team for the powerful APIs
- The open-source community for inspiration

---

**Made with ❤️ for the browser migration community**

