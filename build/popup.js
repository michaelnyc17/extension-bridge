let allResults=[],currentFilter="all",currentSort="default",lastScanTime=null,notifications=[],CACHE_KEY="extension_bridge_cache",CACHE_VERSION="1.0",NOTIFICATIONS_KEY="extension_bridge_notifications",IGNORED_RESULTS_KEY="extension_bridge_ignored_results",loadingState=document.getElementById("loading-state"),resultsState=document.getElementById("results-state"),errorState=document.getElementById("error-state"),progressText=document.getElementById("progress-text"),summaryText=document.getElementById("summary-text"),resultsContainer=document.getElementById("results-container"),searchInput=document.getElementById("search-input"),sortSelect=document.getElementById("sort-select"),exportBtn=document.getElementById("export-btn"),retryBtn=document.getElementById("retry-btn"),errorMessage=document.getElementById("error-message"),rescanBtn=document.getElementById("rescan-btn"),lastScanText=document.getElementById("last-scan-text"),bulkInstallBtn=document.getElementById("bulk-install-btn"),settingsBtn=document.getElementById("settings-btn"),settingsModal=document.getElementById("settings-modal"),closeSettingsBtn=document.getElementById("close-settings"),saveSettingsBtn=document.getElementById("save-settings"),resetSettingsBtn=document.getElementById("reset-settings"),welcomeScreen=document.getElementById("welcome-screen"),getStartedBtn=document.getElementById("get-started-btn"),dontShowAgainCheckbox=document.getElementById("dont-show-again"),infoBtn=document.getElementById("info-btn"),notificationsBtn=document.getElementById("notifications-btn"),notificationBadge=document.getElementById("notification-badge"),notificationsModal=document.getElementById("notifications-modal"),closeNotificationsBtn=document.getElementById("close-notifications"),closeNotificationsFooterBtn=document.getElementById("close-notifications-footer"),clearNotificationsBtn=document.getElementById("clear-notifications"),notificationsList=document.getElementById("notifications-list"),selectedExtensions=new Set,SETTINGS_KEY="extension_bridge_settings",WELCOME_SHOWN_KEY="extension_bridge_welcome_shown",IGNORED_KEY="extension_bridge_ignored",DEFAULT_SETTINGS={exactThreshold:85,similarThreshold:50,cacheDuration:24,darkMode:!1,compactMode:!1,developerMatching:!1,notifyIgnored:!0},currentSettings={...DEFAULT_SETTINGS},ignoredExtensions=new Map,ignoredExtensionResults=new Map;async function checkWelcomeShown(){try{return!0===(await chrome.storage.local.get(WELCOME_SHOWN_KEY))[WELCOME_SHOWN_KEY]}catch(e){return console.error("Error checking welcome shown:",e),!1}}async function markWelcomeShown(){try{await chrome.storage.local.set({[WELCOME_SHOWN_KEY]:!0})}catch(e){console.error("Error marking welcome shown:",e)}}function showWelcomeScreen(){welcomeScreen&&welcomeScreen.classList.remove("hidden")}function hideWelcomeScreen(){welcomeScreen&&(welcomeScreen.style.animation="fadeOut 0.4s ease-out forwards",setTimeout(()=>{welcomeScreen.classList.add("hidden"),welcomeScreen.style.animation=""},400))}async function loadSettings(){try{var e=await chrome.storage.local.get(SETTINGS_KEY);e[SETTINGS_KEY]&&(currentSettings={...DEFAULT_SETTINGS,...e[SETTINGS_KEY]}),Matcher.THRESHOLDS.exact=currentSettings.exactThreshold,Matcher.THRESHOLDS.similar=currentSettings.similarThreshold}catch(e){console.error("Error loading settings:",e)}}async function saveSettings(e){try{await chrome.storage.local.set({[SETTINGS_KEY]:e}),currentSettings=e,Matcher.THRESHOLDS.exact=e.exactThreshold,Matcher.THRESHOLDS.similar=e.similarThreshold,applyThemeSettings()}catch(e){console.error("Error saving settings:",e)}}function applyThemeSettings(){document.body.classList.toggle("dark-theme",currentSettings.darkMode),document.body.classList.toggle("compact-mode",currentSettings.compactMode)}async function loadIgnoredExtensions(){try{var e=await chrome.storage.local.get(IGNORED_KEY);e[IGNORED_KEY]&&(ignoredExtensions=new Map(Object.entries(e[IGNORED_KEY])))}catch(e){console.error("Error loading ignored extensions:",e),ignoredExtensions=new Map}}async function saveIgnoredExtensions(){try{var e=Object.fromEntries(ignoredExtensions);await chrome.storage.local.set({[IGNORED_KEY]:e})}catch(e){console.error("Error saving ignored extensions:",e)}}async function ignoreExtension(t,e){ignoredExtensions.set(t,e);var n=allResults.find(e=>e.chromeExtension.id===t);n&&ignoredExtensionResults.set(t,JSON.stringify({name:e,match:n.match,timestamp:Date.now()})),await saveIgnoredExtensions(),await saveIgnoredResults(),renderResults(),updateIgnoredListUI()}async function unignoreExtension(e){ignoredExtensions.delete(e),await saveIgnoredExtensions(),renderResults(),updateIgnoredListUI()}async function clearAllIgnored(){ignoredExtensions.clear(),ignoredExtensionResults.clear(),await saveIgnoredExtensions(),await saveIgnoredResults(),renderResults(),updateIgnoredListUI()}async function loadIgnoredResults(){try{var e=await chrome.storage.local.get(IGNORED_RESULTS_KEY);e[IGNORED_RESULTS_KEY]&&(ignoredExtensionResults=new Map(Object.entries(e[IGNORED_RESULTS_KEY])))}catch(e){console.error("Error loading ignored results:",e),ignoredExtensionResults=new Map}}async function saveIgnoredResults(){try{var e=Object.fromEntries(ignoredExtensionResults);await chrome.storage.local.set({[IGNORED_RESULTS_KEY]:e})}catch(e){console.error("Error saving ignored results:",e)}}async function loadNotifications(){try{var e=await chrome.storage.local.get(NOTIFICATIONS_KEY);e[NOTIFICATIONS_KEY]&&(notifications=e[NOTIFICATIONS_KEY],updateNotificationBadge())}catch(e){console.error("Error loading notifications:",e),notifications=[]}}async function saveNotifications(){try{await chrome.storage.local.set({[NOTIFICATIONS_KEY]:notifications}),updateNotificationBadge()}catch(e){console.error("Error saving notifications:",e)}}async function addNotification(e,t,n,a){e={id:Date.now(),title:e,message:t,extensionId:n,firefoxAddon:a,timestamp:Date.now(),read:!1};notifications.unshift(e),await saveNotifications()}function updateNotificationBadge(){var e=notifications.filter(e=>!e.read).length;0<e&&notificationsBtn&&notificationBadge?(notificationsBtn.classList.remove("hidden"),notificationBadge.classList.remove("hidden"),notificationBadge.textContent=e):notificationsBtn&&notificationBadge&&(0===notifications.length&&notificationsBtn.classList.add("hidden"),notificationBadge.classList.add("hidden"))}async function loadCachedResults(){try{var e=await chrome.storage.local.get(CACHE_KEY);if(e[CACHE_KEY]&&e[CACHE_KEY].version===CACHE_VERSION){var t=e[CACHE_KEY];if(Date.now()-t.timestamp<60*currentSettings.cacheDuration*60*1e3)return t}}catch(e){console.error("Error loading cache:",e)}return null}async function saveCachedResults(e){try{var t={version:CACHE_VERSION,timestamp:Date.now(),results:e};await chrome.storage.local.set({[CACHE_KEY]:t}),lastScanTime=t.timestamp}catch(e){console.error("Error saving cache:",e)}}async function checkIgnoredExtensionsForBetterMatches(){for(let[n,e]of ignoredExtensionResults.entries())try{var a=JSON.parse(e),o=allResults.find(e=>e.chromeExtension.id===n);if(o){var i=a.match,s=o.match;let e=!1,t="";!i&&s?(e=!0,t=`Found a ${s.classification.type} match: `+s.firefoxAddon.name):i&&s&&i.score<s.score?10<=s.score-i.score&&(e=!0,t=`Found a better match (${s.score.toFixed(0)}% vs ${i.score.toFixed(0)}%): `+s.firefoxAddon.name):i&&s&&"exact"!==i.classification.type&&"exact"===s.classification.type&&(e=!0,t="Found an exact match: "+s.firefoxAddon.name),e&&(await addNotification("Better Match Found: "+a.name,t,n,s.firefoxAddon),ignoredExtensionResults.set(n,JSON.stringify({name:a.name,match:s,timestamp:Date.now()})))}}catch(e){console.error("Error checking ignored extension:",e)}await saveIgnoredResults()}async function loadExtensions(){showLoading();try{var e=(await chrome.management.getAll()).filter(e=>"extension"===e.type&&e.id!==chrome.runtime.id&&e.enabled);0===e.length?showError("No extensions found. Install some Chrome extensions first!"):(allResults=await Matcher.processExtensions(e,updateProgress),currentSettings.notifyIgnored&&await checkIgnoredExtensionsForBetterMatches(),await saveCachedResults(allResults),displayResults())}catch(e){console.error("Error loading extensions:",e),showError("Failed to load extensions: "+e.message)}}function updateProgress(e,t){progressText.textContent=e+` of ${t} extensions processed`}function displayResults(){hideLoading(),showResults();var e=calculateStats(allResults);summaryText.textContent=`Found ${e.total} Chrome extensions. Matched ${e.exact} exact, ${e.similar} similar, ${e.none} no match.`,updateLastScanTime(),updateFilterButtons(e),renderResults()}function updateLastScanTime(){var e;lastScanTime&&lastScanText&&(e=getTimeAgo(lastScanTime),lastScanText.textContent="Last scan: "+e)}function getTimeAgo(e){e=Math.floor((Date.now()-e)/1e3);return e<60?"just now":e<3600?Math.floor(e/60)+" minutes ago":e<86400?Math.floor(e/3600)+" hours ago":Math.floor(e/86400)+" days ago"}function showEmptyState(){hideLoading(),showResults(),resultsContainer.innerHTML=`
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h2>No scan data available</h2>
            <p>Click the "Scan Extensions" button to find Firefox alternatives for your Chrome extensions.</p>
        </div>
    `,lastScanText&&(lastScanText.textContent="Never scanned")}function calculateStats(e){return{total:e.length,exact:e.filter(e=>"exact"===e.match?.classification.type).length,similar:e.filter(e=>"similar"===e.match?.classification.type).length,none:e.filter(e=>!e.match||"none"===e.match.classification.type).length}}function updateFilterButtons(e){document.querySelector('[data-filter="all"]').textContent=`All (${e.total})`,document.querySelector('[data-filter="exact"]').textContent=`✅ Exact (${e.exact})`,document.querySelector('[data-filter="similar"]').textContent=`⚠️ Similar (${e.similar})`,document.querySelector('[data-filter="none"]').textContent=`❌ No match (${e.none})`}function renderResults(){let n=searchInput.value.toLowerCase();var e=sortResults(allResults.filter(e=>{if(ignoredExtensions.has(e.chromeExtension.id))return!1;if("all"!==currentFilter&&(e.match?.classification.type||"none")!==currentFilter)return!1;if(n){var t=e.chromeExtension.name.toLowerCase(),e=e.match?.firefoxAddon.name.toLowerCase()||"";if(!t.includes(n)&&!e.includes(n))return!1}return!0}),currentSort);resultsContainer.innerHTML="",0===e.length?resultsContainer.innerHTML='<div class="no-results">No extensions match your filters.</div>':e.forEach(e=>{e=createResultCard(e);resultsContainer.appendChild(e)})}function sortResults(e,t){var n=[...e];switch(t){case"name":n.sort((e,t)=>e.chromeExtension.name.localeCompare(t.chromeExtension.name));break;case"match-score":n.sort((e,t)=>{e=e.match?.score||0;return(t.match?.score||0)-e});break;case"rating":n.sort((e,t)=>{e=e.match?.firefoxAddon.rating||0;return(t.match?.firefoxAddon.rating||0)-e});break;case"users":n.sort((e,t)=>{e=e.match?.firefoxAddon.users||0;return(t.match?.firefoxAddon.users||0)-e});break;default:n.sort((e,t)=>{var n={exact:0,similar:1,none:2},a=e.match?.classification.type||"none",o=t.match?.classification.type||"none",a=n[a]-n[o];return 0!=a?a:(n=e.match?.score||0,(t.match?.score||0)-n)})}return n}function createResultCard(e){var n=document.createElement("div");n.className="result-card";let a=e.chromeExtension,o=e.match;var e=a.icons?.[0]?.url||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%23667eea" width="32" height="32" rx="4"/><text x="16" y="22" font-size="20" text-anchor="middle" fill="white">📦</text></svg>',i=PortabilityAnalyzer.analyzePortability(a);if(o&&"none"!==o.classification.type){let t=o.firefoxAddon;var s="badge-"+o.classification.type,r=t.icon||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%23ff6611" width="32" height="32" rx="4"/><text x="16" y="22" font-size="20" text-anchor="middle" fill="white">🦊</text></svg>',c=selectedExtensions.has(t.url),s=(n.innerHTML=`
            <div class="result-header">
                <div class="chrome-extension">
                    <img src="${e}" class="extension-icon" onerror="this.style.display='none'">
                    <div class="extension-info">
                        <h3>${escapeHtml(a.name)}</h3>
                        <p class="extension-desc">${escapeHtml(a.description||"")}</p>
                        <span class="portability-badge ${i.className}" title="${i.reasons.join("; ")}">${i.label}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <span class="match-badge ${s}">${o.classification.label}</span>
                    <button class="compare-btn">🔍 Compare</button>
                    <button class="ignore-btn" data-id="${a.id}" data-name="${escapeHtml(a.name)}">❌ Ignore</button>
                </div>
            </div>

            <div class="firefox-match">
                <input type="checkbox" class="select-checkbox" data-url="${t.url}" ${c?"checked":""}>
                <div class="match-arrow">→</div>
                <div class="firefox-addon">
                    <img src="${r}" class="extension-icon" onerror="this.style.display='none'">
                    <div class="addon-info">
                        <h4>${escapeHtml(t.name)}</h4>
                        <div class="addon-stats">
                            <span class="rating">⭐ ${t.rating.toFixed(1)}</span>
                            <span class="users">${formatNumber(t.users)} users</span>
                            <span class="confidence">${Math.round(o.score)}% match</span>
                        </div>
                        <p class="match-reasons">Matched by: ${o.matchReasons.join(", ")}</p>
                    </div>
                </div>
                <a href="${t.url}" target="_blank" class="install-btn">Install on Firefox →</a>
            </div>

            ${"similar"===o.classification.type?'<div class="warning">⚠️ Not exact match - verify functionality before installing</div>':""}
        `,n.querySelector(".select-checkbox")),c=(s&&s.addEventListener("change",e=>{e.target.checked?selectedExtensions.add(t.url):selectedExtensions.delete(t.url),updateBulkInstallButton()}),n.querySelector(".compare-btn"));c&&c.addEventListener("click",()=>{openComparisonModal(a,t,o)})}else n.innerHTML=`
            <div class="result-header">
                <div class="chrome-extension">
                    <img src="${e}" class="extension-icon" onerror="this.style.display='none'">
                    <div class="extension-info">
                        <h3>${escapeHtml(a.name)}</h3>
                        <p class="extension-desc">${escapeHtml(a.description||"No description")}</p>
                        <span class="portability-badge ${i.className}" title="${i.reasons.join("; ")}">${i.label}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <span class="match-badge badge-none">❌ No Match</span>
                    <button class="ignore-btn" data-id="${a.id}" data-name="${escapeHtml(a.name)}">❌ Ignore</button>
                </div>
            </div>
            <div class="no-match-message">
                No Firefox alternative found.
                <a href="https://addons.mozilla.org/firefox/search/?q=${encodeURIComponent(a.name)}" target="_blank">Search manually</a>
            </div>
        `;let t=n.querySelector(".ignore-btn");return t&&t.addEventListener("click",async()=>{await ignoreExtension(t.dataset.id,t.dataset.name)}),n}function updateBulkInstallButton(){bulkInstallBtn&&(0<selectedExtensions.size?(bulkInstallBtn.classList.remove("hidden"),bulkInstallBtn.textContent=`📦 Open Selected (${selectedExtensions.size})`):bulkInstallBtn.classList.add("hidden"))}function exportData(e){var t=allResults.filter(e=>e.match&&"none"!==e.match.classification.type);let n="",a="extension-bridge-export-"+Date.now(),o="text/plain";switch(e){case"txt":n=exportAsText(t),a+=".txt",o="text/plain";break;case"csv":n=exportAsCSV(t),a+=".csv",o="text/csv";break;case"json":n=exportAsJSON(t),a+=".json",o="application/json";break;case"html":n=exportAsHTML(t),a+=".html",o="text/html"}downloadFile(n,a,o)}function exportAsText(e){return e.map(e=>e.chromeExtension.name+" → "+e.match.firefoxAddon.url).join("\n")}function exportAsCSV(e){return[["Chrome Extension","Chrome URL","Firefox Alternative","Firefox URL","Match Score (%)","Match Type","Rating","Users"],...e.map(e=>{var t=e.chromeExtension,n=e.match.firefoxAddon,e=e.match;return[escapeCSV(t.name),escapeCSV(t.homepageUrl||"N/A"),escapeCSV(n.name),escapeCSV(n.url),Math.round(e.score),e.classification.type,n.rating.toFixed(1),n.users]})].map(e=>e.join(",")).join("\n")}function escapeCSV(e){e=String(e||"");return e.includes(",")||e.includes('"')||e.includes("\n")?`"${e.replace(/"/g,'""')}"`:e}function exportAsJSON(e){e={exportDate:(new Date).toISOString(),extensionBridgeVersion:"3.3.0",totalMatches:e.length,matches:e.map(e=>({chrome:{name:e.chromeExtension.name,id:e.chromeExtension.id,description:e.chromeExtension.description,homepageUrl:e.chromeExtension.homepageUrl,version:e.chromeExtension.version},firefox:{name:e.match.firefoxAddon.name,url:e.match.firefoxAddon.url,description:e.match.firefoxAddon.description,rating:e.match.firefoxAddon.rating,users:e.match.firefoxAddon.users,homepage:e.match.firefoxAddon.homepage},match:{score:e.match.score,type:e.match.classification.type,confidence:e.match.classification.confidence,reasons:e.match.matchReasons}}))};return JSON.stringify(e,null,2)}function exportAsHTML(e){var t=e.filter(e=>"exact"===e.match.classification.type),n=e.filter(e=>"similar"===e.match.classification.type);return`<!DOCTYPE html>
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
        <p class="subtitle">Generated on ${(new Date).toLocaleString()}</p>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${e.length}</div>
                <div class="stat-label">Total Matches</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${t.length}</div>
                <div class="stat-label">Exact Matches</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${n.length}</div>
                <div class="stat-label">Similar Matches</div>
            </div>
        </div>

        ${0<t.length?`
        <div class="section">
            <h2 class="section-title">✅ Exact Matches (${t.length})</h2>
            ${t.map(e=>generateMatchCard(e,"exact")).join("")}
        </div>
        `:""}

        ${0<n.length?`
        <div class="section">
            <h2 class="section-title">⚠️ Similar Matches (${n.length})</h2>
            ${n.map(e=>generateMatchCard(e,"similar")).join("")}
        </div>
        `:""}

        <div class="footer">
            Generated by Extension Bridge | Find Firefox alternatives for Chrome extensions
        </div>
    </div>
</body>
</html>`}function generateMatchCard(e,t){var n=e.chromeExtension,a=e.match.firefoxAddon,e=e.match;return`
        <div class="match-card ${t}">
            <div class="match-header">
                <div class="extension-name">${escapeHtml(n.name)}</div>
                <span class="match-badge badge-${t}">${Math.round(e.score)}% match</span>
            </div>
            <div class="arrow">↓</div>
            <div class="firefox-name">${escapeHtml(a.name)}</div>
            <div class="stats-row">
                <span>⭐ ${a.rating.toFixed(1)}</span>
                <span>👥 ${formatNumber(a.users)} users</span>
                <span>🔍 ${e.matchReasons.join(", ")}</span>
            </div>
            <a href="${a.url}" target="_blank" class="firefox-url">${a.url}</a>
        </div>
    `}function downloadFile(e,t,n){e=new Blob([e],{type:n}),n=URL.createObjectURL(e),e=document.createElement("a");e.href=n,e.download=t,document.body.appendChild(e),e.click(),document.body.removeChild(e),URL.revokeObjectURL(n);let a=exportBtn.textContent;exportBtn.textContent="✓ Exported!",setTimeout(()=>{exportBtn.textContent=a},2e3)}document.addEventListener("DOMContentLoaded",async()=>{try{var e;await loadSettings(),await loadIgnoredExtensions(),await loadIgnoredResults(),await loadNotifications(),applyThemeSettings(),Matcher.ENABLE_DEVELOPER_MATCHING=currentSettings.developerMatching,(await checkWelcomeShown()?(e=await loadCachedResults())?(allResults=e.results,lastScanTime=e.timestamp,displayResults):showEmptyState:showWelcomeScreen)()}catch(e){showError(e.message)}});let comparisonModal=document.getElementById("comparison-modal"),closeComparisonBtn=document.getElementById("close-comparison"),closeComparisonFooterBtn=document.getElementById("close-comparison-footer"),comparisonContent=document.getElementById("comparison-content");function openComparisonModal(e,t,n){var a=PortabilityAnalyzer.analyzePortability(e);comparisonContent.innerHTML=`
        <div class="comparison-section">
            <h3 class="comparison-section-title">Chrome Extension</h3>
            <div class="comparison-item">
                <div class="comparison-label">Name</div>
                <div class="comparison-value">${escapeHtml(e.name)}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Description</div>
                <div class="comparison-value">${escapeHtml(e.description||"No description")}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Version</div>
                <div class="comparison-value">${escapeHtml(e.version||"Unknown")}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Homepage</div>
                <div class="comparison-value">
                    ${e.homepageUrl?`<a href="${e.homepageUrl}" target="_blank" class="comparison-link">${e.homepageUrl}</a>`:"Not available"}
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Portability</div>
                <div class="comparison-value">
                    <span class="portability-badge ${a.className}">${a.label}</span>
                    <div class="portability-reasons">${a.reasons.join("; ")}</div>
                </div>
            </div>
        </div>

        <div class="comparison-section">
            <h3 class="comparison-section-title">Firefox Alternative</h3>
            <div class="comparison-item">
                <div class="comparison-label">Name</div>
                <div class="comparison-value">${escapeHtml(t.name)}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Description</div>
                <div class="comparison-value">${escapeHtml(t.description||"No description")}</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Rating</div>
                <div class="comparison-value">⭐ ${t.rating.toFixed(1)} / 5.0</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Users</div>
                <div class="comparison-value">👥 ${formatNumber(t.users)} users</div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Homepage</div>
                <div class="comparison-value">
                    ${t.homepage?`<a href="${t.homepage}" target="_blank" class="comparison-link">${t.homepage}</a>`:"Not available"}
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Add-on URL</div>
                <div class="comparison-value">
                    <a href="${t.url}" target="_blank" class="comparison-link">${t.url}</a>
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Match Score</div>
                <div class="comparison-value">
                    <span class="match-badge badge-${n.classification.type}">${Math.round(n.score)}% - ${n.classification.label}</span>
                    <div class="match-reasons-comparison">Matched by: ${n.matchReasons.join(", ")}</div>
                </div>
            </div>
        </div>
    `,comparisonModal.classList.remove("hidden")}function closeComparisonModal(){comparisonModal.classList.add("hidden")}closeComparisonBtn&&closeComparisonBtn.addEventListener("click",closeComparisonModal),closeComparisonFooterBtn&&closeComparisonFooterBtn.addEventListener("click",closeComparisonModal),comparisonModal&&comparisonModal.addEventListener("click",e=>{e.target===comparisonModal&&closeComparisonModal()}),document.querySelectorAll(".filter-btn").forEach(e=>{e.addEventListener("click",()=>{document.querySelectorAll(".filter-btn").forEach(e=>e.classList.remove("active")),e.classList.add("active"),currentFilter=e.dataset.filter,renderResults()})}),searchInput.addEventListener("input",()=>{renderResults()}),sortSelect&&sortSelect.addEventListener("change",()=>{currentSort=sortSelect.value,renderResults()});let exportMenu=document.getElementById("export-menu"),exactThresholdSlider=(exportBtn.addEventListener("click",e=>{e.stopPropagation(),exportMenu.classList.toggle("hidden")}),document.addEventListener("click",e=>{exportBtn.contains(e.target)||exportMenu.contains(e.target)||exportMenu.classList.add("hidden")}),document.querySelectorAll(".export-option").forEach(t=>{t.addEventListener("click",()=>{var e=t.dataset.format;exportMenu.classList.add("hidden"),exportData(e)})}),retryBtn.addEventListener("click",()=>{loadExtensions()}),rescanBtn&&rescanBtn.addEventListener("click",()=>{loadExtensions()}),bulkInstallBtn&&bulkInstallBtn.addEventListener("click",()=>{Array.from(selectedExtensions).forEach(e=>{chrome.tabs.create({url:e,active:!1})});let e=bulkInstallBtn.textContent;bulkInstallBtn.textContent="✓ Opened in new tabs!",setTimeout(()=>{bulkInstallBtn.textContent=e},2e3)}),settingsBtn&&settingsBtn.addEventListener("click",()=>{openSettingsModal()}),closeSettingsBtn&&closeSettingsBtn.addEventListener("click",()=>{closeSettingsModal()}),saveSettingsBtn&&saveSettingsBtn.addEventListener("click",async()=>{var e=parseInt(document.getElementById("exact-threshold").value),t=parseInt(document.getElementById("similar-threshold").value),n=parseInt(document.getElementById("cache-duration").value),a=document.getElementById("dark-mode-toggle").checked,o=document.getElementById("compact-mode-toggle").checked,i=document.getElementById("developer-match-toggle").checked,e={exactThreshold:e,similarThreshold:t,cacheDuration:n,darkMode:a,compactMode:o,developerMatching:i,notifyIgnored:document.getElementById("notify-ignored-toggle").checked};Matcher.ENABLE_DEVELOPER_MATCHING=i,await saveSettings(e);let s=saveSettingsBtn.textContent;saveSettingsBtn.textContent="✓ Saved!",setTimeout(()=>{saveSettingsBtn.textContent=s,closeSettingsModal()},1e3)}),resetSettingsBtn&&resetSettingsBtn.addEventListener("click",async()=>{await saveSettings(DEFAULT_SETTINGS),updateSettingsUI();let e=resetSettingsBtn.textContent;resetSettingsBtn.textContent="✓ Reset!",setTimeout(()=>{resetSettingsBtn.textContent=e},1e3)}),document.getElementById("exact-threshold")),similarThresholdSlider=document.getElementById("similar-threshold"),cacheDurationSlider=document.getElementById("cache-duration"),clearIgnoredBtn=(exactThresholdSlider&&exactThresholdSlider.addEventListener("input",e=>{document.getElementById("exact-value").textContent=e.target.value}),similarThresholdSlider&&similarThresholdSlider.addEventListener("input",e=>{document.getElementById("similar-value").textContent=e.target.value}),cacheDurationSlider&&cacheDurationSlider.addEventListener("input",e=>{document.getElementById("cache-value").textContent=e.target.value}),document.getElementById("clear-ignored"));function openSettingsModal(){updateSettingsUI(),settingsModal.classList.remove("hidden")}function closeSettingsModal(){settingsModal.classList.add("hidden")}function updateSettingsUI(){document.getElementById("exact-threshold").value=currentSettings.exactThreshold,document.getElementById("exact-value").textContent=currentSettings.exactThreshold,document.getElementById("similar-threshold").value=currentSettings.similarThreshold,document.getElementById("similar-value").textContent=currentSettings.similarThreshold,document.getElementById("cache-duration").value=currentSettings.cacheDuration,document.getElementById("cache-value").textContent=currentSettings.cacheDuration,document.getElementById("dark-mode-toggle").checked=currentSettings.darkMode,document.getElementById("compact-mode-toggle").checked=currentSettings.compactMode,document.getElementById("developer-match-toggle").checked=currentSettings.developerMatching,document.getElementById("notify-ignored-toggle").checked=currentSettings.notifyIgnored,updateIgnoredListUI()}function updateIgnoredListUI(){let a=document.getElementById("ignored-list");a&&(a.innerHTML="",0!==ignoredExtensions.size)&&ignoredExtensions.forEach((e,t)=>{var n=document.createElement("div");n.className="ignored-item",n.innerHTML=`
            <span class="ignored-item-name">${escapeHtml(e)}</span>
            <button class="unignore-btn" data-id="${t}">Unignore</button>
        `,n.querySelector(".unignore-btn").addEventListener("click",()=>{unignoreExtension(t)}),a.appendChild(n)})}function openNotificationsModal(){updateNotificationsListUI(),notificationsModal.classList.remove("hidden"),notifications.forEach(e=>e.read=!0),saveNotifications()}function closeNotificationsModal(){notificationsModal.classList.add("hidden")}function updateNotificationsListUI(){notificationsList&&(notificationsList.innerHTML="",0!==notifications.length)&&notifications.forEach(t=>{var e=document.createElement("div"),n=(e.className="notification-item "+(t.read?"":"unread"),getTimeAgo(t.timestamp));e.innerHTML=`
            <div class="notification-header">
                <div>
                    <div class="notification-title">${escapeHtml(t.title)}</div>
                    <div class="notification-time">${n}</div>
                </div>
            </div>
            <div class="notification-message">${escapeHtml(t.message)}</div>
            <div class="notification-actions">
                <button class="notification-btn view-btn" data-id="${t.extensionId}">View Extension</button>
                <button class="notification-btn dismiss-btn" data-notification-id="${t.id}">Dismiss</button>
            </div>
        `,e.querySelector(".view-btn").addEventListener("click",async()=>{await unignoreExtension(t.extensionId),closeNotificationsModal()}),e.querySelector(".dismiss-btn").addEventListener("click",async()=>{notifications=notifications.filter(e=>e.id!==t.id),await saveNotifications(),updateNotificationsListUI()}),notificationsList.appendChild(e)})}function showLoading(){loadingState.classList.remove("hidden"),resultsState.classList.add("hidden"),errorState.classList.add("hidden")}function showResults(){loadingState.classList.add("hidden"),resultsState.classList.remove("hidden"),errorState.classList.add("hidden")}function showError(e){loadingState.classList.add("hidden"),resultsState.classList.add("hidden"),errorState.classList.remove("hidden"),errorMessage.textContent=e}function hideLoading(){loadingState.classList.add("hidden")}function escapeHtml(e){var t=document.createElement("div");return t.textContent=e,t.innerHTML}function formatNumber(e){return 1e6<=e?(e/1e6).toFixed(1)+"M":1e3<=e?(e/1e3).toFixed(1)+"K":e.toString()}clearIgnoredBtn&&clearIgnoredBtn.addEventListener("click",async()=>{if(confirm("Are you sure you want to clear all ignored extensions?")){await clearAllIgnored();let e=clearIgnoredBtn.textContent;clearIgnoredBtn.textContent="✓ Cleared!",setTimeout(()=>{clearIgnoredBtn.textContent=e},1500)}}),settingsModal&&settingsModal.addEventListener("click",e=>{e.target===settingsModal&&closeSettingsModal()}),getStartedBtn&&getStartedBtn.addEventListener("click",async()=>{dontShowAgainCheckbox&&dontShowAgainCheckbox.checked&&await markWelcomeShown(),hideWelcomeScreen(),setTimeout(async()=>{var e=await loadCachedResults();(e?(allResults=e.results,lastScanTime=e.timestamp,displayResults):showEmptyState)()},400)}),infoBtn&&infoBtn.addEventListener("click",()=>{showWelcomeScreen()}),notificationsBtn&&notificationsBtn.addEventListener("click",()=>{openNotificationsModal()}),closeNotificationsBtn&&closeNotificationsBtn.addEventListener("click",()=>{closeNotificationsModal()}),closeNotificationsFooterBtn&&closeNotificationsFooterBtn.addEventListener("click",()=>{closeNotificationsModal()}),clearNotificationsBtn&&clearNotificationsBtn.addEventListener("click",async()=>{notifications=[],await saveNotifications(),updateNotificationsListUI(),closeNotificationsModal()}),notificationsModal&&notificationsModal.addEventListener("click",e=>{e.target===notificationsModal&&closeNotificationsModal()});