// Copyright (c) 2025 ExtensionBridge. All Rights Reserved.
// Unauthorized copying, distribution, or use is strictly prohibited.


/**
 * Popup Orchestration Logic
 * Main entry point for the Extension Bridge popup
 */

let allResults = [];
let currentFilter = 'all';
let currentSort = 'default';
let lastScanTime = null;
let notifications = [];

// Cache key for storing results
const CACHE_KEY = 'extension_bridge_cache';
const CACHE_VERSION = '1.0';
const NOTIFICATIONS_KEY = 'extension_bridge_notifications';
const IGNORED_RESULTS_KEY = 'extension_bridge_ignored_results';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const resultsState = document.getElementById('results-state');
const errorState = document.getElementById('error-state');
const progressText = document.getElementById('progress-text');
const summaryText = document.getElementById('summary-text');
const resultsContainer = document.getElementById('results-container');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const exportBtn = document.getElementById('export-btn');
const retryBtn = document.getElementById('retry-btn');
const errorMessage = document.getElementById('error-message');
const rescanBtn = document.getElementById('rescan-btn');
const lastScanText = document.getElementById('last-scan-text');
const bulkInstallBtn = document.getElementById('bulk-install-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const resetSettingsBtn = document.getElementById('reset-settings');
const welcomeScreen = document.getElementById('welcome-screen');
const getStartedBtn = document.getElementById('get-started-btn');
const dontShowAgainCheckbox = document.getElementById('dont-show-again');
const infoBtn = document.getElementById('info-btn');
const notificationsBtn = document.getElementById('notifications-btn');
const notificationBadge = document.getElementById('notification-badge');
const notificationsModal = document.getElementById('notifications-modal');
const closeNotificationsBtn = document.getElementById('close-notifications');
const closeNotificationsFooterBtn = document.getElementById('close-notifications-footer');
const clearNotificationsBtn = document.getElementById('clear-notifications');
const notificationsList = document.getElementById('notifications-list');
let selectedExtensions = new Set();

// Settings
const SETTINGS_KEY = 'extension_bridge_settings';
const WELCOME_SHOWN_KEY = 'extension_bridge_welcome_shown';
const IGNORED_KEY = 'extension_bridge_ignored';
const DEFAULT_SETTINGS = {
    exactThreshold: 85,
    similarThreshold: 50,
    cacheDuration: 24,
    darkMode: false,
    compactMode: false,
    developerMatching: false,
    notifyIgnored: true
};
let currentSettings = { ...DEFAULT_SETTINGS };
let ignoredExtensions = new Map();
let ignoredExtensionResults = new Map();

/**
 * Initialize popup on load
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load settings first
        await loadSettings();
        await loadIgnoredExtensions();
        await loadIgnoredResults();
        await loadNotifications();

        // Apply theme settings
        applyThemeSettings();

        // Update matcher settings
        Matcher.ENABLE_DEVELOPER_MATCHING = currentSettings.developerMatching;

        // Check if welcome screen should be shown
        const welcomeShown = await checkWelcomeShown();
        if (!welcomeShown) {
            showWelcomeScreen();
        } else {
            // Try to load cached results first
            const cached = await loadCachedResults();
            if (cached) {
                allResults = cached.results;
                lastScanTime = cached.timestamp;
                displayResults();
            } else {
                // No cache, show empty state with scan button
                showEmptyState();
            }
        }
    } catch (error) {
        showError(error.message);
    }
});

/**
 * Check if welcome screen has been shown
 */
async function checkWelcomeShown() {
    try {
        const data = await chrome.storage.local.get(WELCOME_SHOWN_KEY);
        return data[WELCOME_SHOWN_KEY] === true;
    } catch (error) {
        console.error('Error checking welcome shown:', error);
        return false;
    }
}

/**
 * Mark welcome screen as shown
 */
async function markWelcomeShown() {
    try {
        await chrome.storage.local.set({ [WELCOME_SHOWN_KEY]: true });
    } catch (error) {
        console.error('Error marking welcome shown:', error);
    }
}

/**
 * Show welcome screen
 */
function showWelcomeScreen() {
    if (welcomeScreen) {
        welcomeScreen.classList.remove('hidden');
    }
}

/**
 * Hide welcome screen with animation
 */
function hideWelcomeScreen() {
    if (welcomeScreen) {
        welcomeScreen.style.animation = 'fadeOut 0.4s ease-out forwards';
        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
            welcomeScreen.style.animation = '';
        }, 400);
    }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        if (data[SETTINGS_KEY]) {
            currentSettings = { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
        }
        // Update matcher thresholds
        Matcher.THRESHOLDS.exact = currentSettings.exactThreshold;
        Matcher.THRESHOLDS.similar = currentSettings.similarThreshold;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Save settings to storage
 */
async function saveSettings(settings) {
    try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        currentSettings = settings;
        // Update matcher thresholds
        Matcher.THRESHOLDS.exact = settings.exactThreshold;
        Matcher.THRESHOLDS.similar = settings.similarThreshold;
        // Apply theme changes
        applyThemeSettings();
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

/**
 * Apply theme settings to body
 */
function applyThemeSettings() {
    document.body.classList.toggle('dark-theme', currentSettings.darkMode);
    document.body.classList.toggle('compact-mode', currentSettings.compactMode);
}

/**
 * Load ignored extensions from storage
 */
async function loadIgnoredExtensions() {
    try {
        const data = await chrome.storage.local.get(IGNORED_KEY);
        if (data[IGNORED_KEY]) {
            // Load as Map to store both ID and name
            ignoredExtensions = new Map(Object.entries(data[IGNORED_KEY]));
        }
    } catch (error) {
        console.error('Error loading ignored extensions:', error);
        ignoredExtensions = new Map();
    }
}

/**
 * Save ignored extensions to storage
 */
async function saveIgnoredExtensions() {
    try {
        // Convert Map to object for storage
        const ignoredObj = Object.fromEntries(ignoredExtensions);
        await chrome.storage.local.set({ [IGNORED_KEY]: ignoredObj });
    } catch (error) {
        console.error('Error saving ignored extensions:', error);
    }
}

/**
 * Add extension to ignored list
 */
async function ignoreExtension(extensionId, extensionName) {
    ignoredExtensions.set(extensionId, extensionName);

    // Save the current match result for this extension
    const result = allResults.find(r => r.chromeExtension.id === extensionId);
    if (result) {
        ignoredExtensionResults.set(extensionId, JSON.stringify({
            name: extensionName,
            match: result.match,
            timestamp: Date.now()
        }));
    }

    await saveIgnoredExtensions();
    await saveIgnoredResults();
    // Refresh results to hide ignored extension
    renderResults();
    updateIgnoredListUI();
}

/**
 * Remove extension from ignored list
 */
async function unignoreExtension(extensionId) {
    ignoredExtensions.delete(extensionId);
    await saveIgnoredExtensions();
    // Refresh results to show extension again
    renderResults();
    // Update ignored list in settings if open
    updateIgnoredListUI();
}

/**
 * Clear all ignored extensions
 */
async function clearAllIgnored() {
    ignoredExtensions.clear();
    ignoredExtensionResults.clear();
    await saveIgnoredExtensions();
    await saveIgnoredResults();
    renderResults();
    updateIgnoredListUI();
}

/**
 * Load ignored extension results from storage
 */
async function loadIgnoredResults() {
    try {
        const data = await chrome.storage.local.get(IGNORED_RESULTS_KEY);
        if (data[IGNORED_RESULTS_KEY]) {
            ignoredExtensionResults = new Map(Object.entries(data[IGNORED_RESULTS_KEY]));
        }
    } catch (error) {
        console.error('Error loading ignored results:', error);
        ignoredExtensionResults = new Map();
    }
}

/**
 * Save ignored extension results to storage
 */
async function saveIgnoredResults() {
    try {
        const ignoredObj = Object.fromEntries(ignoredExtensionResults);
        await chrome.storage.local.set({ [IGNORED_RESULTS_KEY]: ignoredObj });
    } catch (error) {
        console.error('Error saving ignored results:', error);
    }
}

/**
 * Load notifications from storage
 */
async function loadNotifications() {
    try {
        const data = await chrome.storage.local.get(NOTIFICATIONS_KEY);
        if (data[NOTIFICATIONS_KEY]) {
            notifications = data[NOTIFICATIONS_KEY];
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        notifications = [];
    }
}

/**
 * Save notifications to storage
 */
async function saveNotifications() {
    try {
        await chrome.storage.local.set({ [NOTIFICATIONS_KEY]: notifications });
        updateNotificationBadge();
    } catch (error) {
        console.error('Error saving notifications:', error);
    }
}

/**
 * Add a notification
 */
async function addNotification(title, message, extensionId, firefoxAddon) {
    const notification = {
        id: Date.now(),
        title,
        message,
        extensionId,
        firefoxAddon,
        timestamp: Date.now(),
        read: false
    };
    notifications.unshift(notification);
    await saveNotifications();
}

/**
 * Update notification badge
 */
function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0 && notificationsBtn && notificationBadge) {
        notificationsBtn.classList.remove('hidden');
        notificationBadge.classList.remove('hidden');
        notificationBadge.textContent = unreadCount;
    } else if (notificationsBtn && notificationBadge) {
        if (notifications.length === 0) {
            notificationsBtn.classList.add('hidden');
        }
        notificationBadge.classList.add('hidden');
    }
}

/**
 * Load cached results from storage
 */
async function loadCachedResults() {
    try {
        const data = await chrome.storage.local.get(CACHE_KEY);
        if (data[CACHE_KEY] && data[CACHE_KEY].version === CACHE_VERSION) {
            const cache = data[CACHE_KEY];
            // Cache expires based on settings
            const cacheAge = Date.now() - cache.timestamp;
            const cacheDurationMs = currentSettings.cacheDuration * 60 * 60 * 1000;
            if (cacheAge < cacheDurationMs) {
                return cache;
            }
        }
    } catch (error) {
        console.error('Error loading cache:', error);
    }
    return null;
}

/**
 * Save results to cache
 */
async function saveCachedResults(results) {
    try {
        const cache = {
            version: CACHE_VERSION,
            timestamp: Date.now(),
            results: results
        };
        await chrome.storage.local.set({ [CACHE_KEY]: cache });
        lastScanTime = cache.timestamp;
    } catch (error) {
        console.error('Error saving cache:', error);
    }
}

/**
 * Check for better matches for ignored extensions
 */
async function checkIgnoredExtensionsForBetterMatches() {
    for (const [extensionId, savedDataStr] of ignoredExtensionResults.entries()) {
        try {
            const savedData = JSON.parse(savedDataStr);
            const currentResult = allResults.find(r => r.chromeExtension.id === extensionId);

            if (!currentResult) continue;

            const oldMatch = savedData.match;
            const newMatch = currentResult.match;

            // Check if we found a better match
            let isBetter = false;
            let reason = '';

            if (!oldMatch && newMatch) {
                // Found a match where there was none before
                isBetter = true;
                reason = `Found a ${newMatch.classification.type} match: ${newMatch.firefoxAddon.name}`;
            } else if (oldMatch && newMatch && oldMatch.score < newMatch.score) {
                // Found a better match
                const scoreDiff = newMatch.score - oldMatch.score;
                if (scoreDiff >= 10) { // Significant improvement
                    isBetter = true;
                    reason = `Found a better match (${newMatch.score.toFixed(0)}% vs ${oldMatch.score.toFixed(0)}%): ${newMatch.firefoxAddon.name}`;
                }
            } else if (oldMatch && newMatch && oldMatch.classification.type !== 'exact' && newMatch.classification.type === 'exact') {
                // Upgraded to exact match
                isBetter = true;
                reason = `Found an exact match: ${newMatch.firefoxAddon.name}`;
            }

            if (isBetter) {
                await addNotification(
                    `Better Match Found: ${savedData.name}`,
                    reason,
                    extensionId,
                    newMatch.firefoxAddon
                );

                // Update stored result
                ignoredExtensionResults.set(extensionId, JSON.stringify({
                    name: savedData.name,
                    match: newMatch,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error('Error checking ignored extension:', error);
        }
    }

    await saveIgnoredResults();
}

/**
 * Load and process Chrome extensions
 */
async function loadExtensions() {
    showLoading();

    try {
        // Get all Chrome extensions
        const extensions = await chrome.management.getAll();

        // Filter out this extension and themes
        const validExtensions = extensions.filter(ext =>
            ext.type === 'extension' &&
            ext.id !== chrome.runtime.id &&
            ext.enabled
        );

        if (validExtensions.length === 0) {
            showError('No extensions found. Install some Chrome extensions first!');
            return;
        }

        // Process extensions and find Firefox matches
        allResults = await Matcher.processExtensions(
            validExtensions,
            updateProgress
        );

        // Check for better matches for ignored extensions
        if (currentSettings.notifyIgnored) {
            await checkIgnoredExtensionsForBetterMatches();
        }

        // Save to cache
        await saveCachedResults(allResults);

        displayResults();
    } catch (error) {
        console.error('Error loading extensions:', error);
        showError('Failed to load extensions: ' + error.message);
    }
}

/**
 * Update progress indicator
 */
function updateProgress(processed, total) {
    progressText.textContent = `${processed} of ${total} extensions processed`;
}

/**
 * Display results in UI
 */
function displayResults() {
    hideLoading();
    showResults();

    // Calculate summary stats
    const stats = calculateStats(allResults);
    summaryText.textContent = `Found ${stats.total} Chrome extensions. Matched ${stats.exact} exact, ${stats.similar} similar, ${stats.none} no match.`;

    // Update last scan time
    updateLastScanTime();

    // Update filter buttons with counts
    updateFilterButtons(stats);

    // Render all results
    renderResults();
}

/**
 * Update last scan time display
 */
function updateLastScanTime() {
    if (lastScanTime && lastScanText) {
        const timeAgo = getTimeAgo(lastScanTime);
        lastScanText.textContent = `Last scan: ${timeAgo}`;
    }
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

/**
 * Show empty state with scan button
 */
function showEmptyState() {
    hideLoading();
    showResults();
    resultsContainer.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h2>No scan data available</h2>
            <p>Click the "Scan Extensions" button to find Firefox alternatives for your Chrome extensions.</p>
        </div>
    `;
    if (lastScanText) {
        lastScanText.textContent = 'Never scanned';
    }
}

/**
 * Calculate statistics from results
 */
function calculateStats(results) {
    return {
        total: results.length,
        exact: results.filter(r => r.match?.classification.type === 'exact').length,
        similar: results.filter(r => r.match?.classification.type === 'similar').length,
        none: results.filter(r => !r.match || r.match.classification.type === 'none').length
    };
}

/**
 * Update filter buttons with counts
 */
function updateFilterButtons(stats) {
    document.querySelector('[data-filter="all"]').textContent = `All (${stats.total})`;
    document.querySelector('[data-filter="exact"]').textContent = `✅ Exact (${stats.exact})`;
    document.querySelector('[data-filter="similar"]').textContent = `⚠️ Similar (${stats.similar})`;
    document.querySelector('[data-filter="none"]').textContent = `❌ No match (${stats.none})`;
}

/**
 * Render results based on current filter and search
 */
function renderResults() {
    const searchTerm = searchInput.value.toLowerCase();

    const filteredResults = allResults.filter(result => {
        // Filter out ignored extensions
        if (ignoredExtensions.has(result.chromeExtension.id)) {
            return false;
        }

        // Apply filter
        if (currentFilter !== 'all') {
            const matchType = result.match?.classification.type || 'none';
            if (matchType !== currentFilter) return false;
        }

        // Apply search
        if (searchTerm) {
            const chromeName = result.chromeExtension.name.toLowerCase();
            const firefoxName = result.match?.firefoxAddon.name.toLowerCase() || '';
            if (!chromeName.includes(searchTerm) && !firefoxName.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    // Apply sorting
    const sortedResults = sortResults(filteredResults, currentSort);

    resultsContainer.innerHTML = '';

    if (sortedResults.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No extensions match your filters.</div>';
        return;
    }

    sortedResults.forEach(result => {
        const resultCard = createResultCard(result);
        resultsContainer.appendChild(resultCard);
    });
}

/**
 * Sort results based on selected sort option
 */
function sortResults(results, sortBy) {
    const sortedResults = [...results];

    switch (sortBy) {
        case 'name':
            sortedResults.sort((a, b) =>
                a.chromeExtension.name.localeCompare(b.chromeExtension.name)
            );
            break;

        case 'match-score':
            sortedResults.sort((a, b) => {
                const scoreA = a.match?.score || 0;
                const scoreB = b.match?.score || 0;
                return scoreB - scoreA; // Descending
            });
            break;

        case 'rating':
            sortedResults.sort((a, b) => {
                const ratingA = a.match?.firefoxAddon.rating || 0;
                const ratingB = b.match?.firefoxAddon.rating || 0;
                return ratingB - ratingA; // Descending
            });
            break;

        case 'users':
            sortedResults.sort((a, b) => {
                const usersA = a.match?.firefoxAddon.users || 0;
                const usersB = b.match?.firefoxAddon.users || 0;
                return usersB - usersA; // Descending
            });
            break;

        case 'default':
        default:
            // Default sorting: exact matches first, then similar, then none
            sortedResults.sort((a, b) => {
                const typeOrder = { exact: 0, similar: 1, none: 2 };
                const typeA = a.match?.classification.type || 'none';
                const typeB = b.match?.classification.type || 'none';
                const orderDiff = typeOrder[typeA] - typeOrder[typeB];

                if (orderDiff !== 0) return orderDiff;

                // Within same type, sort by score
                const scoreA = a.match?.score || 0;
                const scoreB = b.match?.score || 0;
                return scoreB - scoreA;
            });
            break;
    }

    return sortedResults;
}

/**
 * Create result card HTML element
 */
function createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const chromeExt = result.chromeExtension;
    const match = result.match;

    const chromeIconUrl = chromeExt.icons?.[0]?.url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%23667eea" width="32" height="32" rx="4"/><text x="16" y="22" font-size="20" text-anchor="middle" fill="white">📦</text></svg>';

    // Analyze portability
    const portability = PortabilityAnalyzer.analyzePortability(chromeExt);

    if (!match || match.classification.type === 'none') {
        card.innerHTML = `
            <div class="result-header">
                <div class="chrome-extension">
                    <img src="${chromeIconUrl}" class="extension-icon" onerror="this.style.display='none'">
                    <div class="extension-info">
                        <h3>${escapeHtml(chromeExt.name)}</h3>
                        <p class="extension-desc">${escapeHtml(chromeExt.description || 'No description')}</p>
                        <span class="portability-badge ${portability.className}" title="${portability.reasons.join('; ')}">${portability.label}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <span class="match-badge badge-none">❌ No Match</span>
                    <button class="ignore-btn" data-id="${chromeExt.id}" data-name="${escapeHtml(chromeExt.name)}">❌ Ignore</button>
                </div>
            </div>
            <div class="no-match-message">
                No Firefox alternative found.
                <a href="https://addons.mozilla.org/firefox/search/?q=${encodeURIComponent(chromeExt.name)}" target="_blank">Search manually</a>
            </div>
        `;
    } else {
        const firefox = match.firefoxAddon;
        const badgeClass = `badge-${match.classification.type}`;
        const firefoxIconUrl = firefox.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%23ff6611" width="32" height="32" rx="4"/><text x="16" y="22" font-size="20" text-anchor="middle" fill="white">🦊</text></svg>';
        const isSelected = selectedExtensions.has(firefox.url);

        card.innerHTML = `
            <div class="result-header">
                <div class="chrome-extension">
                    <img src="${chromeIconUrl}" class="extension-icon" onerror="this.style.display='none'">
                    <div class="extension-info">
                        <h3>${escapeHtml(chromeExt.name)}</h3>
                        <p class="extension-desc">${escapeHtml(chromeExt.description || '')}</p>
                        <span class="portability-badge ${portability.className}" title="${portability.reasons.join('; ')}">${portability.label}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <span class="match-badge ${badgeClass}">${match.classification.label}</span>
                    <button class="compare-btn">🔍 Compare</button>
                    <button class="ignore-btn" data-id="${chromeExt.id}" data-name="${escapeHtml(chromeExt.name)}">❌ Ignore</button>
                </div>
            </div>

            <div class="firefox-match">
                <input type="checkbox" class="select-checkbox" data-url="${firefox.url}" ${isSelected ? 'checked' : ''}>
                <div class="match-arrow">→</div>
                <div class="firefox-addon">
                    <img src="${firefoxIconUrl}" class="extension-icon" onerror="this.style.display='none'">
                    <div class="addon-info">
                        <h4>${escapeHtml(firefox.name)}</h4>
                        <div class="addon-stats">
                            <span class="rating">⭐ ${firefox.rating.toFixed(1)}</span>
                            <span class="users">${formatNumber(firefox.users)} users</span>
                            <span class="confidence">${Math.round(match.score)}% match</span>
                        </div>
                        <p class="match-reasons">Matched by: ${match.matchReasons.join(', ')}</p>
                    </div>
                </div>
                <a href="${firefox.url}" target="_blank" class="install-btn">Install on Firefox →</a>
            </div>

            ${match.classification.type === 'similar' ? '<div class="warning">⚠️ Not exact match - verify functionality before installing</div>' : ''}
        `;

        // Add checkbox event listener
        const checkbox = card.querySelector('.select-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedExtensions.add(firefox.url);
                } else {
                    selectedExtensions.delete(firefox.url);
                }
                updateBulkInstallButton();
            });
        }

        // Add compare button event listener
        const compareBtn = card.querySelector('.compare-btn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                openComparisonModal(chromeExt, firefox, match);
            });
        }
    }

    // Add ignore button event listener
    const ignoreBtn = card.querySelector('.ignore-btn');
    if (ignoreBtn) {
        ignoreBtn.addEventListener('click', async () => {
            const id = ignoreBtn.dataset.id;
            const name = ignoreBtn.dataset.name;
            await ignoreExtension(id, name);
        });
    }

    return card;
}

/**
 * Update bulk install button visibility and text
 */
function updateBulkInstallButton() {
    if (bulkInstallBtn) {
        if (selectedExtensions.size > 0) {
            bulkInstallBtn.classList.remove('hidden');
            bulkInstallBtn.textContent = `📦 Open Selected (${selectedExtensions.size})`;
        } else {
            bulkInstallBtn.classList.add('hidden');
        }
    }
}

/**
 * Export data in different formats
 */
function exportData(format) {
    const matchedResults = allResults.filter(r => r.match && r.match.classification.type !== 'none');

    let content = '';
    let filename = `extension-bridge-export-${Date.now()}`;
    let mimeType = 'text/plain';

    switch (format) {
        case 'txt':
            content = exportAsText(matchedResults);
            filename += '.txt';
            mimeType = 'text/plain';
            break;

        case 'csv':
            content = exportAsCSV(matchedResults);
            filename += '.csv';
            mimeType = 'text/csv';
            break;

        case 'json':
            content = exportAsJSON(matchedResults);
            filename += '.json';
            mimeType = 'application/json';
            break;

        case 'html':
            content = exportAsHTML(matchedResults);
            filename += '.html';
            mimeType = 'text/html';
            break;
    }

    downloadFile(content, filename, mimeType);
}

/**
 * Export as plain text URLs
 */
function exportAsText(results) {
    return results
        .map(r => `${r.chromeExtension.name} → ${r.match.firefoxAddon.url}`)
        .join('\n');
}

/**
 * Export as CSV
 */
function exportAsCSV(results) {
    const headers = ['Chrome Extension', 'Chrome URL', 'Firefox Alternative', 'Firefox URL', 'Match Score (%)', 'Match Type', 'Rating', 'Users'];
    const rows = results.map(r => {
        const chrome = r.chromeExtension;
        const firefox = r.match.firefoxAddon;
        const match = r.match;

        return [
            escapeCSV(chrome.name),
            escapeCSV(chrome.homepageUrl || 'N/A'),
            escapeCSV(firefox.name),
            escapeCSV(firefox.url),
            Math.round(match.score),
            match.classification.type,
            firefox.rating.toFixed(1),
            firefox.users
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

    return csvContent;
}

/**
 * Escape CSV field
 */
function escapeCSV(field) {
    const str = String(field || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Export as JSON
 */
function exportAsJSON(results) {
    const exportData = {
        exportDate: new Date().toISOString(),
        extensionBridgeVersion: '3.3.0',
        totalMatches: results.length,
        matches: results.map(r => ({
            chrome: {
                name: r.chromeExtension.name,
                id: r.chromeExtension.id,
                description: r.chromeExtension.description,
                homepageUrl: r.chromeExtension.homepageUrl,
                version: r.chromeExtension.version
            },
            firefox: {
                name: r.match.firefoxAddon.name,
                url: r.match.firefoxAddon.url,
                description: r.match.firefoxAddon.description,
                rating: r.match.firefoxAddon.rating,
                users: r.match.firefoxAddon.users,
                homepage: r.match.firefoxAddon.homepage
            },
            match: {
                score: r.match.score,
                type: r.match.classification.type,
                confidence: r.match.classification.confidence,
                reasons: r.match.matchReasons
            }
        }))
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Export as HTML report
 */
function exportAsHTML(results) {
    const exactMatches = results.filter(r => r.match.classification.type === 'exact');
    const similarMatches = results.filter(r => r.match.classification.type === 'similar');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Extension Bridge Export Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            color: #1a1a2e;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 32px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle { color: #666; margin-bottom: 30px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 24px;
            margin-bottom: 20px;
            color: #1a1a2e;
        }
        .match-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }
        .match-card.similar {
            border-left-color: #ffa500;
        }
        .match-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
        }
        .extension-name {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a2e;
        }
        .match-badge {
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-exact {
            background: #d4edda;
            color: #155724;
        }
        .badge-similar {
            background: #fff3cd;
            color: #856404;
        }
        .arrow { color: #667eea; margin: 10px 0; font-size: 20px; }
        .firefox-name {
            font-size: 16px;
            color: #667eea;
            font-weight: 500;
            margin-bottom: 8px;
        }
        .stats-row {
            display: flex;
            gap: 15px;
            font-size: 14px;
            color: #666;
        }
        .firefox-url {
            display: inline-block;
            margin-top: 10px;
            color: #667eea;
            text-decoration: none;
            font-size: 14px;
        }
        .firefox-url:hover {
            text-decoration: underline;
        }
        .footer {
            text-align: center;
            color: #999;
            font-size: 14px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Extension Bridge Export Report</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${results.length}</div>
                <div class="stat-label">Total Matches</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${exactMatches.length}</div>
                <div class="stat-label">Exact Matches</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${similarMatches.length}</div>
                <div class="stat-label">Similar Matches</div>
            </div>
        </div>

        ${exactMatches.length > 0 ? `
        <div class="section">
            <h2 class="section-title">✅ Exact Matches (${exactMatches.length})</h2>
            ${exactMatches.map(r => generateMatchCard(r, 'exact')).join('')}
        </div>
        ` : ''}

        ${similarMatches.length > 0 ? `
        <div class="section">
            <h2 class="section-title">⚠️ Similar Matches (${similarMatches.length})</h2>
            ${similarMatches.map(r => generateMatchCard(r, 'similar')).join('')}
        </div>
        ` : ''}

        <div class="footer">
            Generated by Extension Bridge | Find Firefox alternatives for Chrome extensions
        </div>
    </div>
</body>
</html>`;

    return htmlContent;
}

/**
 * Generate HTML match card
 */
function generateMatchCard(result, type) {
    const chrome = result.chromeExtension;
    const firefox = result.match.firefoxAddon;
    const match = result.match;

    return `
        <div class="match-card ${type}">
            <div class="match-header">
                <div class="extension-name">${escapeHtml(chrome.name)}</div>
                <span class="match-badge badge-${type}">${Math.round(match.score)}% match</span>
            </div>
            <div class="arrow">↓</div>
            <div class="firefox-name">${escapeHtml(firefox.name)}</div>
            <div class="stats-row">
                <span>⭐ ${firefox.rating.toFixed(1)}</span>
                <span>👥 ${formatNumber(firefox.users)} users</span>
                <span>🔍 ${match.matchReasons.join(', ')}</span>
            </div>
            <a href="${firefox.url}" target="_blank" class="firefox-url">${firefox.url}</a>
        </div>
    `;
}

/**
 * Download file to user's system
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show confirmation
    const originalText = exportBtn.textContent;
    exportBtn.textContent = '✓ Exported!';
    setTimeout(() => {
        exportBtn.textContent = originalText;
    }, 2000);
}

/**
 * Comparison Modal Functions
 */
const comparisonModal = document.getElementById('comparison-modal');
const closeComparisonBtn = document.getElementById('close-comparison');
const closeComparisonFooterBtn = document.getElementById('close-comparison-footer');
const comparisonContent = document.getElementById('comparison-content');

/**
 * Open comparison modal
 */
function openComparisonModal(chromeExt, firefoxAddon, match) {
    const portability = PortabilityAnalyzer.analyzePortability(chromeExt);

    comparisonContent.innerHTML = `
        <div class="comparison-section">
            <h3 class="comparison-section-title">Chrome Extension</h3>
            <div class="comparison-item">
                <div class="comparison-label">Name</div>
                <div class="comparison-value">${escapeHtml(chromeExt.name)}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Description</div>
                <div class="comparison-value">${escapeHtml(chromeExt.description || 'No description')}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Version</div>
                <div class="comparison-value">${escapeHtml(chromeExt.version || 'Unknown')}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Homepage</div>
                <div class="comparison-value">
                    ${chromeExt.homepageUrl
                        ? `<a href="${chromeExt.homepageUrl}" target="_blank" class="comparison-link">${chromeExt.homepageUrl}</a>`
                        : 'Not available'}
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Portability</div>
                <div class="comparison-value">
                    <span class="portability-badge ${portability.className}">${portability.label}</span>
                    <div class="portability-reasons">${portability.reasons.join('; ')}</div>
                </div>
            </div>
        </div>

        <div class="comparison-section">
            <h3 class="comparison-section-title">Firefox Alternative</h3>
            <div class="comparison-item">
                <div class="comparison-label">Name</div>
                <div class="comparison-value">${escapeHtml(firefoxAddon.name)}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Description</div>
                <div class="comparison-value">${escapeHtml(firefoxAddon.description || 'No description')}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Rating</div>
                <div class="comparison-value">⭐ ${firefoxAddon.rating.toFixed(1)} / 5.0</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Users</div>
                <div class="comparison-value">👥 ${formatNumber(firefoxAddon.users)} users</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Homepage</div>
                <div class="comparison-value">
                    ${firefoxAddon.homepage
                        ? `<a href="${firefoxAddon.homepage}" target="_blank" class="comparison-link">${firefoxAddon.homepage}</a>`
                        : 'Not available'}
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Add-on URL</div>
                <div class="comparison-value">
                    <a href="${firefoxAddon.url}" target="_blank" class="comparison-link">${firefoxAddon.url}</a>
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Match Score</div>
                <div class="comparison-value">
                    <span class="match-badge badge-${match.classification.type}">${Math.round(match.score)}% - ${match.classification.label}</span>
                    <div class="match-reasons-comparison">Matched by: ${match.matchReasons.join(', ')}</div>
                </div>
            </div>
        </div>
    `;

    comparisonModal.classList.remove('hidden');
}

/**
 * Close comparison modal
 */
function closeComparisonModal() {
    comparisonModal.classList.add('hidden');
}

// Comparison modal event listeners
if (closeComparisonBtn) {
    closeComparisonBtn.addEventListener('click', closeComparisonModal);
}

if (closeComparisonFooterBtn) {
    closeComparisonFooterBtn.addEventListener('click', closeComparisonModal);
}

// Close modal when clicking outside
if (comparisonModal) {
    comparisonModal.addEventListener('click', (e) => {
        if (e.target === comparisonModal) {
            closeComparisonModal();
        }
    });
}

/**
 * Setup event listeners
 */

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderResults();
    });
});

// Search input
searchInput.addEventListener('input', () => {
    renderResults();
});

// Sort select
if (sortSelect) {
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        renderResults();
    });
}

// Export button and dropdown
const exportMenu = document.getElementById('export-menu');
exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('hidden');
});

// Close export menu when clicking outside
document.addEventListener('click', (e) => {
    if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
        exportMenu.classList.add('hidden');
    }
});

// Export option buttons
document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        exportMenu.classList.add('hidden');
        exportData(format);
    });
});

// Retry button
retryBtn.addEventListener('click', () => {
    loadExtensions();
});

// Rescan button
if (rescanBtn) {
    rescanBtn.addEventListener('click', () => {
        loadExtensions();
    });
}

// Bulk install button
if (bulkInstallBtn) {
    bulkInstallBtn.addEventListener('click', () => {
        const urls = Array.from(selectedExtensions);
        urls.forEach(url => {
            chrome.tabs.create({ url, active: false });
        });

        // Show confirmation
        const originalText = bulkInstallBtn.textContent;
        bulkInstallBtn.textContent = '✓ Opened in new tabs!';
        setTimeout(() => {
            bulkInstallBtn.textContent = originalText;
        }, 2000);
    });
}

// Settings button
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        openSettingsModal();
    });
}

// Close settings button
if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        closeSettingsModal();
    });
}

// Save settings button
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
        const exactThreshold = parseInt(document.getElementById('exact-threshold').value);
        const similarThreshold = parseInt(document.getElementById('similar-threshold').value);
        const cacheDuration = parseInt(document.getElementById('cache-duration').value);
        const darkMode = document.getElementById('dark-mode-toggle').checked;
        const compactMode = document.getElementById('compact-mode-toggle').checked;
        const developerMatching = document.getElementById('developer-match-toggle').checked;
        const notifyIgnored = document.getElementById('notify-ignored-toggle').checked;

        const newSettings = {
            exactThreshold,
            similarThreshold,
            cacheDuration,
            darkMode,
            compactMode,
            developerMatching,
            notifyIgnored
        };

        // Update matcher setting
        Matcher.ENABLE_DEVELOPER_MATCHING = developerMatching;

        await saveSettings(newSettings);

        // Show confirmation
        const originalText = saveSettingsBtn.textContent;
        saveSettingsBtn.textContent = '✓ Saved!';
        setTimeout(() => {
            saveSettingsBtn.textContent = originalText;
            closeSettingsModal();
        }, 1000);
    });
}

// Reset settings button
if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', async () => {
        await saveSettings(DEFAULT_SETTINGS);
        updateSettingsUI();

        // Show confirmation
        const originalText = resetSettingsBtn.textContent;
        resetSettingsBtn.textContent = '✓ Reset!';
        setTimeout(() => {
            resetSettingsBtn.textContent = originalText;
        }, 1000);
    });
}

// Settings sliders
const exactThresholdSlider = document.getElementById('exact-threshold');
const similarThresholdSlider = document.getElementById('similar-threshold');
const cacheDurationSlider = document.getElementById('cache-duration');

if (exactThresholdSlider) {
    exactThresholdSlider.addEventListener('input', (e) => {
        document.getElementById('exact-value').textContent = e.target.value;
    });
}

if (similarThresholdSlider) {
    similarThresholdSlider.addEventListener('input', (e) => {
        document.getElementById('similar-value').textContent = e.target.value;
    });
}

if (cacheDurationSlider) {
    cacheDurationSlider.addEventListener('input', (e) => {
        document.getElementById('cache-value').textContent = e.target.value;
    });
}

// Clear ignored button
const clearIgnoredBtn = document.getElementById('clear-ignored');
if (clearIgnoredBtn) {
    clearIgnoredBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all ignored extensions?')) {
            await clearAllIgnored();
            const originalText = clearIgnoredBtn.textContent;
            clearIgnoredBtn.textContent = '✓ Cleared!';
            setTimeout(() => {
                clearIgnoredBtn.textContent = originalText;
            }, 1500);
        }
    });
}

/**
 * Open settings modal
 */
function openSettingsModal() {
    updateSettingsUI();
    settingsModal.classList.remove('hidden');
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
    settingsModal.classList.add('hidden');
}

/**
 * Update settings UI with current values
 */
function updateSettingsUI() {
    document.getElementById('exact-threshold').value = currentSettings.exactThreshold;
    document.getElementById('exact-value').textContent = currentSettings.exactThreshold;

    document.getElementById('similar-threshold').value = currentSettings.similarThreshold;
    document.getElementById('similar-value').textContent = currentSettings.similarThreshold;

    document.getElementById('cache-duration').value = currentSettings.cacheDuration;
    document.getElementById('cache-value').textContent = currentSettings.cacheDuration;

    document.getElementById('dark-mode-toggle').checked = currentSettings.darkMode;
    document.getElementById('compact-mode-toggle').checked = currentSettings.compactMode;
    document.getElementById('developer-match-toggle').checked = currentSettings.developerMatching;
    document.getElementById('notify-ignored-toggle').checked = currentSettings.notifyIgnored;

    updateIgnoredListUI();
}

/**
 * Update ignored list UI
 */
function updateIgnoredListUI() {
    const ignoredList = document.getElementById('ignored-list');
    if (!ignoredList) return;

    ignoredList.innerHTML = '';

    if (ignoredExtensions.size === 0) {
        return; // Will show "No ignored extensions" via CSS
    }

    ignoredExtensions.forEach((name, id) => {
        const item = document.createElement('div');
        item.className = 'ignored-item';
        item.innerHTML = `
            <span class="ignored-item-name">${escapeHtml(name)}</span>
            <button class="unignore-btn" data-id="${id}">Unignore</button>
        `;

        const unignoreBtn = item.querySelector('.unignore-btn');
        unignoreBtn.addEventListener('click', () => {
            unignoreExtension(id);
        });

        ignoredList.appendChild(item);
    });
}

// Close modal when clicking outside
if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
}

// Get Started button
if (getStartedBtn) {
    getStartedBtn.addEventListener('click', async () => {
        // Save preference if checkbox is checked
        if (dontShowAgainCheckbox && dontShowAgainCheckbox.checked) {
            await markWelcomeShown();
        }

        // Hide welcome screen and load app
        hideWelcomeScreen();

        // Load cached results or show empty state
        setTimeout(async () => {
            const cached = await loadCachedResults();
            if (cached) {
                allResults = cached.results;
                lastScanTime = cached.timestamp;
                displayResults();
            } else {
                showEmptyState();
            }
        }, 400);
    });
}

// Info button to show welcome screen again
if (infoBtn) {
    infoBtn.addEventListener('click', () => {
        showWelcomeScreen();
    });
}

// Notifications button
if (notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
        openNotificationsModal();
    });
}

// Close notifications buttons
if (closeNotificationsBtn) {
    closeNotificationsBtn.addEventListener('click', () => {
        closeNotificationsModal();
    });
}

if (closeNotificationsFooterBtn) {
    closeNotificationsFooterBtn.addEventListener('click', () => {
        closeNotificationsModal();
    });
}

// Clear notifications button
if (clearNotificationsBtn) {
    clearNotificationsBtn.addEventListener('click', async () => {
        notifications = [];
        await saveNotifications();
        updateNotificationsListUI();
        closeNotificationsModal();
    });
}

// Close notifications modal when clicking outside
if (notificationsModal) {
    notificationsModal.addEventListener('click', (e) => {
        if (e.target === notificationsModal) {
            closeNotificationsModal();
        }
    });
}

/**
 * Open notifications modal
 */
function openNotificationsModal() {
    updateNotificationsListUI();
    notificationsModal.classList.remove('hidden');

    // Mark all as read
    notifications.forEach(n => n.read = true);
    saveNotifications();
}

/**
 * Close notifications modal
 */
function closeNotificationsModal() {
    notificationsModal.classList.add('hidden');
}

/**
 * Update notifications list UI
 */
function updateNotificationsListUI() {
    if (!notificationsList) return;

    notificationsList.innerHTML = '';

    if (notifications.length === 0) {
        return; // Will show "No notifications" via CSS
    }

    notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${!notification.read ? 'unread' : ''}`;

        const timeAgo = getTimeAgo(notification.timestamp);

        item.innerHTML = `
            <div class="notification-header">
                <div>
                    <div class="notification-title">${escapeHtml(notification.title)}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            </div>
            <div class="notification-message">${escapeHtml(notification.message)}</div>
            <div class="notification-actions">
                <button class="notification-btn view-btn" data-id="${notification.extensionId}">View Extension</button>
                <button class="notification-btn dismiss-btn" data-notification-id="${notification.id}">Dismiss</button>
            </div>
        `;

        // View button
        const viewBtn = item.querySelector('.view-btn');
        viewBtn.addEventListener('click', async () => {
            // Unignore the extension
            await unignoreExtension(notification.extensionId);
            closeNotificationsModal();
        });

        // Dismiss button
        const dismissBtn = item.querySelector('.dismiss-btn');
        dismissBtn.addEventListener('click', async () => {
            notifications = notifications.filter(n => n.id !== notification.id);
            await saveNotifications();
            updateNotificationsListUI();
        });

        notificationsList.appendChild(item);
    });
}

/**
 * UI state management
 */
function showLoading() {
    loadingState.classList.remove('hidden');
    resultsState.classList.add('hidden');
    errorState.classList.add('hidden');
}

function showResults() {
    loadingState.classList.add('hidden');
    resultsState.classList.remove('hidden');
    errorState.classList.add('hidden');
}

function showError(message) {
    loadingState.classList.add('hidden');
    resultsState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = message;
}

function hideLoading() {
    loadingState.classList.add('hidden');
}

/**
 * Utility functions
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
