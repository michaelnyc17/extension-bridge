/**
 * Firefox Add-ons API Wrapper
 * Handles all communication with Mozilla's Add-ons API
 */

const FirefoxAPI = {
    BASE_URL: 'https://addons.mozilla.org/api/v5/addons/search/',
    cache: new Map(),
    timeout: 5000, // 5 second timeout per request

    /**
     * Search for Firefox addons by query
     */
    async search(query, options = {}) {
        if (!query) return [];

        // Check cache first
        const cacheKey = this.getCacheKey(query, options);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const params = new URLSearchParams({
            q: query,
            app: 'firefox',
            type: 'extension',
            sort: 'relevance',
            ...options
        });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.BASE_URL}?${params.toString()}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            const results = this.parseResults(data);

            // Cache the results
            this.cache.set(cacheKey, results);

            return results;
        } catch (error) {
            console.error('Firefox API error:', error);
            return [];
        }
    },

    /**
     * Safely extract string value from API field (handles localized strings)
     */
    extractString(field) {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (typeof field === 'object') {
            return field.en || field['en-US'] || Object.values(field)[0] || '';
        }
        return String(field);
    },

    /**
     * Parse API response into simplified format
     */
    parseResults(data) {
        if (!data || !data.results) return [];

        return data.results.map(addon => ({
            name: this.extractString(addon.name),
            slug: addon.slug || '',
            description: this.extractString(addon.summary),
            rating: addon.ratings?.average || 0,
            users: addon.average_daily_users || 0,
            url: addon.url || `https://addons.mozilla.org/firefox/addon/${addon.slug}/`,
            homepage: this.extractString(addon.homepage?.url),
            developer: addon.authors?.[0]?.name || '',
            icon: addon.icon_url || '',
            categories: addon.categories?.firefox || [],
            lastUpdated: addon.last_updated || '',
            guid: addon.guid || ''
        }));
    },

    /**
     * Search with multiple strategies (name, short name, description terms)
     */
    async searchWithStrategies(chromeExt) {
        const strategies = [];

        // Strategy 1: Exact name
        if (chromeExt.name) {
            strategies.push(this.search(chromeExt.name));
        }

        // Strategy 2: Short name (if different from name)
        if (chromeExt.shortName && chromeExt.shortName !== chromeExt.name) {
            strategies.push(this.search(chromeExt.shortName));
        }

        // Strategy 3: Description keywords (if first two fail)
        // We'll execute this conditionally later

        // Execute first two strategies in parallel
        const results = await Promise.all(strategies);
        const combinedResults = this.deduplicateResults([...results[0], ...(results[1] || [])]);

        // If we got good results, return them
        if (combinedResults.length >= 3) {
            return combinedResults;
        }

        // Strategy 3: Try description keywords
        if (chromeExt.description) {
            const keywords = StringSimilarity.extractKeywords(chromeExt.description)
                .slice(0, 3)
                .join(' ');

            if (keywords) {
                const descResults = await this.search(keywords);
                return this.deduplicateResults([...combinedResults, ...descResults]);
            }
        }

        return combinedResults;
    },

    /**
     * Remove duplicate results based on slug
     */
    deduplicateResults(results) {
        const seen = new Set();
        return results.filter(addon => {
            if (seen.has(addon.slug)) {
                return false;
            }
            seen.add(addon.slug);
            return true;
        });
    },

    /**
     * Generate cache key
     */
    getCacheKey(query, options) {
        return `${query}_${JSON.stringify(options)}`;
    },

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
    }
};
