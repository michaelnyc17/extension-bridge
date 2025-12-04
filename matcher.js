




/**
 * Matching Algorithm
 * Computes match scores between Chrome extensions and Firefox addons
 */

const Matcher = {
    
    ENABLE_DEVELOPER_MATCHING: false,

    
    WEIGHTS: {
        name: 0.40,
        url: 0.30,
        description: 0.20,
        category: 0.10
    },

    
    THRESHOLDS: {
        exact: 85,
        similar: 50
    },

    /**
     * Compute name similarity score (0-100)
     */
    computeNameSimilarity(chromeName, firefoxName) {
        return StringSimilarity.getSimilarityScore(chromeName, firefoxName);
    },

    /**
     * Compute URL match score (0-100)
     */
    computeUrlMatch(chromeUrl, firefoxUrl) {
        return StringSimilarity.compareUrls(chromeUrl, firefoxUrl);
    },

    /**
     * Compute description overlap score (0-100)
     */
    computeDescriptionOverlap(chromeDesc, firefoxDesc) {
        return StringSimilarity.compareDescriptions(chromeDesc, firefoxDesc);
    },

    /**
     * Compute category match score (0-100)
     * Note: Chrome extensions API doesn't provide categories,
     * so this is a placeholder for future enhancement
     */
    computeCategoryMatch(chromeExt, firefoxAddon) {
        
        
        
        return 50;
    },

    /**
     * Compute developer similarity
     */
    computeDeveloperSimilarity(chromeDev, firefoxDev) {
        if (!chromeDev || !firefoxDev) return 0;

        const chromeDevNorm = StringSimilarity.normalize(chromeDev);
        const firefoxDevNorm = StringSimilarity.normalize(firefoxDev);

        if (chromeDevNorm === firefoxDevNorm) return 100;

        return StringSimilarity.getSimilarityScore(chromeDev, firefoxDev);
    },

    /**
     * Compute final weighted score
     */
    computeFinalScore(scores, developerBonus = 0) {
        let baseScore = (
            scores.name * this.WEIGHTS.name +
            scores.url * this.WEIGHTS.url +
            scores.description * this.WEIGHTS.description +
            scores.category * this.WEIGHTS.category
        );

        
        if (this.ENABLE_DEVELOPER_MATCHING && developerBonus > 0) {
            baseScore = Math.min(100, baseScore + (developerBonus * 0.15));
        }

        return baseScore;
    },

    /**
     * Classify match based on score
     */
    classifyMatch(score) {
        if (score >= this.THRESHOLDS.exact) {
            return {
                type: 'exact',
                label: '✅ Exact Match',
                confidence: 'high'
            };
        } else if (score >= this.THRESHOLDS.similar) {
            return {
                type: 'similar',
                label: '⚠️ Similar Alternative',
                confidence: 'medium'
            };
        } else {
            return {
                type: 'none',
                label: '❌ No Good Match',
                confidence: 'low'
            };
        }
    },

    /**
     * Find best match for a Chrome extension from Firefox results
     */
    findBestMatch(chromeExt, firefoxResults) {
        if (!firefoxResults || firefoxResults.length === 0) {
            return null;
        }

        let bestMatch = null;
        let bestScore = 0;

        for (const firefoxAddon of firefoxResults) {
            const scores = {
                name: this.computeNameSimilarity(chromeExt.name, firefoxAddon.name),
                url: this.computeUrlMatch(
                    chromeExt.homepageUrl || '',
                    firefoxAddon.homepage
                ),
                description: this.computeDescriptionOverlap(
                    chromeExt.description || '',
                    firefoxAddon.description
                ),
                category: this.computeCategoryMatch(chromeExt, firefoxAddon)
            };

            
            let developerBonus = 0;
            if (this.ENABLE_DEVELOPER_MATCHING) {
                const chromeDev = chromeExt.author || '';
                const firefoxDev = firefoxAddon.developer || '';
                developerBonus = this.computeDeveloperSimilarity(chromeDev, firefoxDev);
            }

            const finalScore = this.computeFinalScore(scores, developerBonus);

            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestMatch = {
                    firefoxAddon,
                    score: finalScore,
                    classification: this.classifyMatch(finalScore),
                    breakdown: scores,
                    developerBonus,
                    matchReasons: this.getMatchReasons(scores, chromeExt, firefoxAddon, developerBonus)
                };
            }
        }

        
        
        if (bestMatch && bestMatch.classification.type === 'none' && bestScore >= 30) {
            bestMatch.classification = {
                type: 'similar',
                label: '⚠️ Possible Match',
                confidence: 'low'
            };
        }

        return bestMatch;
    },

    /**
     * Generate human-readable match reasons
     */
    getMatchReasons(scores, chromeExt, firefoxAddon, developerBonus = 0) {
        const reasons = [];

        if (scores.name >= 90) {
            reasons.push('identical name');
        } else if (scores.name >= 70) {
            reasons.push('similar name');
        }

        if (scores.url === 100) {
            reasons.push('same homepage URL');
        } else if (scores.url === 90) {
            reasons.push('same domain/repository');
        }

        if (scores.description >= 70) {
            reasons.push('similar description');
        }

        
        if (this.ENABLE_DEVELOPER_MATCHING && developerBonus >= 80) {
            reasons.push('same developer');
        } else if (this.ENABLE_DEVELOPER_MATCHING && developerBonus >= 60) {
            reasons.push('similar developer');
        }

        
        if (chromeExt.author && firefoxAddon.developer) {
            const authorSimilarity = StringSimilarity.getSimilarityScore(
                chromeExt.author,
                firefoxAddon.developer
            );
            if (authorSimilarity >= 80) {
                reasons.push('same developer');
            }
        }

        if (reasons.length === 0) {
            reasons.push('keyword match only');
        }

        return reasons;
    },

    /**
     * Process all Chrome extensions and find their Firefox matches
     */
    async processExtensions(chromeExtensions, progressCallback) {
        const results = [];
        let processed = 0;

        for (const chromeExt of chromeExtensions) {
            try {
                
                const firefoxResults = await FirefoxAPI.searchWithStrategies(chromeExt);

                
                const bestMatch = this.findBestMatch(chromeExt, firefoxResults);

                results.push({
                    chromeExtension: chromeExt,
                    match: bestMatch,
                    allFirefoxResults: firefoxResults.slice(0, 5) 
                });

                processed++;
                if (progressCallback) {
                    progressCallback(processed, chromeExtensions.length);
                }
            } catch (error) {
                console.error(`Error processing ${chromeExt.name}:`, error);
                results.push({
                    chromeExtension: chromeExt,
                    match: null,
                    error: error.message
                });

                processed++;
                if (progressCallback) {
                    progressCallback(processed, chromeExtensions.length);
                }
            }
        }

        return results;
    }
};
