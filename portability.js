// Copyright (c) 2025 ExtensionBridge. All Rights Reserved.

// Unauthorized copying, distribution, or use is strictly prohibited.


/**
 * Chrome Extension Portability Analyzer
 * Determines if a Chrome extension can be ported to Firefox
 */

const PortabilityAnalyzer = {
    /**
     * Chrome-only APIs that don't have Firefox equivalents
     */
    CHROME_ONLY_APIS: [
        'chrome.instanceID',
        'chrome.gcm',
        'chrome.enterprise',
        'chrome.documentScan',
        'chrome.accessibilityFeatures',
        'chrome.wallpaper',
        'chrome.imageWriterPrivate',
        'chrome.mediaGalleries'
    ],

    /**
     * MV3 service worker APIs that may not be fully compatible
     */
    MV3_SERVICE_WORKER_APIS: [
        'chrome.offscreen',
        'chrome.sidePanel',
        'chrome.userScripts'
    ],

    /**
     * Analyze extension portability
     * @param {Object} extension - Chrome extension object
     * @returns {Object} Portability assessment
     */
    analyzePortability(extension) {
        const manifestVersion = extension.manifestVersion || 2;
        const permissions = extension.permissions || [];
        const hostPermissions = extension.hostPermissions || [];

        // Check for Chrome-only APIs
        const chromeOnlyUsed = this.checkChromeOnlyAPIs(permissions);

        // Check for MV3 service worker APIs
        const mv3ServiceWorkerUsed = this.checkMV3ServiceWorkerAPIs(permissions);

        // Determine portability level
        let portability = {
            level: 'likely',
            label: '✅ Likely Portable',
            className: 'portability-likely',
            reasons: [],
            confidence: 'high'
        };

        // Chrome-only APIs make it unlikely
        if (chromeOnlyUsed.length > 0) {
            portability.level = 'unlikely';
            portability.label = '❌ Unlikely Portable';
            portability.className = 'portability-unlikely';
            portability.confidence = 'high';
            portability.reasons.push(`Uses Chrome-only APIs: ${chromeOnlyUsed.join(', ')}`);
        }
        // MV3 with service worker APIs is uncertain
        else if (manifestVersion === 3 && mv3ServiceWorkerUsed.length > 0) {
            portability.level = 'maybe';
            portability.label = '⚠️ Maybe Portable';
            portability.className = 'portability-maybe';
            portability.confidence = 'medium';
            portability.reasons.push('Uses MV3 service worker APIs (Firefox support may be limited)');
        }
        // MV3 without problematic APIs is likely portable
        else if (manifestVersion === 3) {
            portability.level = 'maybe';
            portability.label = '⚠️ Maybe Portable';
            portability.className = 'portability-maybe';
            portability.confidence = 'medium';
            portability.reasons.push('Uses Manifest V3 (Firefox support is improving)');
        }
        // MV2 is generally portable
        else if (manifestVersion === 2) {
            portability.level = 'likely';
            portability.label = '✅ Likely Portable';
            portability.className = 'portability-likely';
            portability.confidence = 'high';
            portability.reasons.push('Uses Manifest V2 (well-supported in Firefox)');
        }

        // Check for excessive permissions
        const excessivePermissions = this.checkExcessivePermissions(permissions, hostPermissions);
        if (excessivePermissions.length > 0) {
            if (portability.level === 'likely') {
                portability.level = 'maybe';
                portability.label = '⚠️ Maybe Portable';
                portability.className = 'portability-maybe';
                portability.confidence = 'medium';
            }
            portability.reasons.push(`Uses sensitive permissions: ${excessivePermissions.join(', ')}`);
        }

        // Add manifest version info
        portability.manifestVersion = manifestVersion;

        return portability;
    },

    /**
     * Check if extension uses Chrome-only APIs
     */
    checkChromeOnlyAPIs(permissions) {
        return permissions.filter(perm =>
            this.CHROME_ONLY_APIS.some(api =>
                perm.includes(api.replace('chrome.', ''))
            )
        );
    },

    /**
     * Check if extension uses MV3 service worker APIs
     */
    checkMV3ServiceWorkerAPIs(permissions) {
        return permissions.filter(perm =>
            this.MV3_SERVICE_WORKER_APIS.some(api =>
                perm.includes(api.replace('chrome.', ''))
            )
        );
    },

    /**
     * Check for potentially problematic permissions
     */
    checkExcessivePermissions(permissions, hostPermissions) {
        const sensitivePerms = [
            'debugger',
            'desktopCapture',
            'downloads',
            'management',
            'nativeMessaging',
            'privacy',
            'proxy',
            'system'
        ];

        const excessive = permissions.filter(perm =>
            sensitivePerms.some(sensitive => perm.includes(sensitive))
        );

        // Check for broad host permissions
        if (hostPermissions && hostPermissions.some(host => host === '<all_urls>' || host === '*://*/*')) {
            excessive.push('broad host access');
        }

        return excessive;
    },

    /**
     * Get detailed portability explanation
     */
    getPortabilityExplanation(portability) {
        const explanations = {
            likely: 'This extension uses standard web extension APIs that are well-supported in Firefox. Porting should be straightforward with minimal changes.',
            maybe: 'This extension may require modifications to work in Firefox. Some APIs or features might need adjustments or alternative implementations.',
            unlikely: 'This extension uses Chrome-specific features that have no Firefox equivalent. Significant rewriting would be needed to port this extension.'
        };

        return explanations[portability.level] || '';
    }
};
