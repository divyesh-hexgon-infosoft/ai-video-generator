const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

class PixabayController {

    constructor(apiKey) {
        this.apiKey = apiKey;
        this.tempDir = path.join(process.cwd(), 'temp');
        this.targetDimensions = {
            width: 1920,
            height: 1080
        };
        this.baseUrl = 'https://pixabay.com/api';
        this.minMatchScore = 0.6;
        this.maxQueryLength = 100; // Pixabay API query length limit
    }

    _extractKeyPhrases(description) {
        // Common words to filter out
        const stopWords = new Set([
            'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
            'background', 'setting', 'scene', 'showing', 'featuring', 'displays', 'contains'
        ]);

        // Split into phrases based on commas and other punctuation
        const phrases = description.toLowerCase()
            .split(/[,.;]/)
            .map(phrase => phrase.trim())
            .filter(phrase => phrase.length > 0);

        // Extract key terms from each phrase
        const keyTerms = phrases.map(phrase => {
            const words = phrase.split(/\s+/)
                .filter(word => !stopWords.has(word))
                .filter(word => word.length > 2);
            
            // Take up to 3 significant words from each phrase
            return words.slice(0, 3).join(' ');
        }).filter(term => term.length > 0);

        return keyTerms;
    }

    _truncateQuery(query) {
        if (query.length <= this.maxQueryLength) {
            return query;
        }
        return query.substring(0, this.maxQueryLength).split(' ').slice(0, -1).join(' ');
    }

    _generateSearchQueries(scene) {
        const queries = new Set();
        
        if (!scene.visualDescription) {
            return ['nature']; // Safe fallback
        }

        // Extract key phrases from visual description
        const keyPhrases = this._extractKeyPhrases(scene.visualDescription);
        
        // Add each key phrase as a separate query
        keyPhrases.forEach(phrase => {
            const truncatedPhrase = this._truncateQuery(phrase);
            if (truncatedPhrase) {
                queries.add(truncatedPhrase);
            }
        });

        // Add specific keywords if available
        if (scene.searchKeywords && Array.isArray(scene.searchKeywords)) {
            scene.searchKeywords.forEach(keyword => {
                const truncatedKeyword = this._truncateQuery(keyword);
                if (truncatedKeyword) {
                    queries.add(truncatedKeyword);
                }
            });
        }

        // Extract main subject and setting as a combined query
        const mainTerms = keyPhrases[0]?.split(' ').slice(0, 3).join(' ');
        if (mainTerms) {
            queries.add(this._truncateQuery(mainTerms));
        }

        // If we still have no valid queries, extract basic terms
        if (queries.size === 0) {
            const basicTerms = scene.visualDescription
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 3)
                .slice(0, 3)
                .join(' ');
            queries.add(this._truncateQuery(basicTerms));
        }

        console.log('Generated search queries:', Array.from(queries));
        return Array.from(queries);
    }

    /**
     * Search for an image on Pixabay with specific dimensions
     * @param {string} query - Search query
     * @returns {Promise<Object>} Image details
     */
    async searchImage(query) {
        try {
            console.log("image search Query pixabay: " + query);
            const response = await fetch(
                `${this.baseUrl}/?key=${this.apiKey}&q=${encodeURIComponent(query)}&per_page=30&orientation=horizontal&min_width=1920&min_height=1080`,
                { headers: { Accept: 'application/json' } }
            );
            const data = await response.json();

            if (!data.hits || data.hits.length === 0) {
                throw new Error(`No images found for query: ${query}`);
            }

            // Filter images to find ones matching our target dimensions or close to it
            const suitablePhotos = data.hits.filter(photo => {
                const targetRatio = this.targetDimensions.width / this.targetDimensions.height;
                const photoRatio = photo.imageWidth / photo.imageHeight;
                const ratioDifference = Math.abs(targetRatio - photoRatio);

                const isHDQuality = photo.imageWidth >= 1920 && photo.imageHeight >= 1080;

                return ratioDifference < 0.1 && isHDQuality;
            });

            if (suitablePhotos.length === 0) {
                console.log(`No photos with target dimensions found for query: ${query}. Falling back to best available.`);
                suitablePhotos.push(data.hits.reduce((best, current) => {
                    return (current.imageWidth > best.imageWidth) ? current : best;
                }, data.hits[0]));
            }

            const photo = suitablePhotos[0];
            console.log(`Selected photo dimensions: ${photo.imageWidth}x${photo.imageHeight}`);

            return {
                type: 'image',
                url: photo.largeImageURL,
                width: photo.imageWidth,
                height: photo.imageHeight,
                photographer: photo.user,
                pixabayUrl: photo.pageURL,
                aspectRatio: photo.imageWidth / photo.imageHeight
            };
        } catch (error) {
            throw new Error(`Image search failed: ${error.message}`);
        }
    }

    /**
     * Search for a video on Pixabay with specific dimensions
     * @param {string} query - Search query
     * @returns {Promise<Object>} Video details
     */
    async searchVideo(query) {
        try {
            const truncatedQuery = this._truncateQuery(query);
            console.log(`Searching video with query: ${truncatedQuery}`);
            
            const response = await fetch(
                `${this.baseUrl}/videos/?key=${this.apiKey}&q=${encodeURIComponent(truncatedQuery)}&per_page=15&orientation=horizontal`,
                { 
                    headers: { Accept: 'application/json' },
                    timeout: 5000 // 5 second timeout
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Invalid content type: ${contentType}`);
            }

            const data = await response.json();

            if (!data.hits || data.hits.length === 0) {
                throw new Error(`No videos found for query: ${truncatedQuery}`);
            }

            // Filter videos to match target dimensions
            const suitableVideos = data.hits.filter(video => {
                const videoFile = video.videos.large;
                return videoFile.width >= this.targetDimensions.width && 
                       videoFile.height >= this.targetDimensions.height;
            });

            let video = suitableVideos[0] || data.hits[0];
            let videoFile = video.videos.large;

            if (!videoFile) {
                throw new Error('No suitable video file available');
            }

            return {
                type: 'video',
                url: videoFile.url,
                width: videoFile.width,
                height: videoFile.height,
                duration: video.duration,
                user: video.user,
                pixabayUrl: video.pageURL,
                aspectRatio: videoFile.width / videoFile.height,
                title: video.tags || ''
            };

        } catch (error) {
            throw new Error(`Video search failed: ${error.message}`);
        }
    }

    /**
     * Search for media based on scene requirements
     * @param {Object} scene - Scene object containing description and media type
     * @returns {Promise<Object>} Media details
     */
    async getMediaForScene(scene) {
            try {
            const { visualDescription, mediaType } = scene;
            
            if (!visualDescription) {
                throw new Error('Scene missing visual description');
            }

            // Generate search queries from scene data
            const searchQueries = this._generateSearchQueries(scene);
            let bestMatch = null;
            let highestScore = 0;

            // Try each search query
            for (const query of searchQueries) {
                try {
                    console.log(`Trying search query: ${query}`);
                    const results = mediaType === 'video' ? 
                        await this.searchVideo(query) : 
                        await this.searchImage(query);
                    
                    // Calculate match score
                    const score = this._calculateMatchScore(results, query);
                    
                    if (score > highestScore) {
                        bestMatch = results;
                        highestScore = score;
                    }
                } catch (error) {
                    console.warn(`Search failed for query "${query}":`, error);
                    continue;
                }
            }

            // If no good matches found, try fallback media type
            if (!bestMatch) {
                const fallbackType = mediaType === 'video' ? 'image' : 'video';
                console.log(`No matches found for ${mediaType}, trying ${fallbackType}...`);
                
                for (const query of searchQueries) {
                    try {
                        const results = fallbackType === 'video' ? 
                            await this.searchVideo(query) : 
                            await this.searchImage(query);
                        
                        const score = this._calculateMatchScore(results, query);
                        if (score > highestScore) {
                            bestMatch = results;
                            highestScore = score;
                        }
                    } catch (error) {
                        console.warn(`Fallback search failed for query "${query}":`, error);
                        continue;
                    }
                }
            }

            if (!bestMatch) {
                throw new Error('No suitable media found for scene');
            }

            return bestMatch;
            } catch (error) {
                throw new Error(`Failed to get media for scene: ${error.message}`);
            }
    }

    async _searchMediaWithRanking(query, mediaType) {
        const results = mediaType === 'video' ? 
            await this.searchVideo(query) : 
            await this.searchImage(query);
        
        // Calculate match score based on multiple factors
        const score = this._calculateMatchScore(results, query);
        
        return {
            media: results,
            score: score
        };
    }

    _calculateMatchScore(media, query) {
        let score = 0;
        
        // Resolution score (40% weight)
        const resolutionScore = Math.min(
            (media.width / this.targetDimensions.width),
            (media.height / this.targetDimensions.height)
        );
        score += resolutionScore * 0.4;
        
        // Aspect ratio score (30% weight)
        const targetRatio = this.targetDimensions.width / this.targetDimensions.height;
        const mediaRatio = media.width / media.height;
        const ratioScore = 1 - Math.abs(targetRatio - mediaRatio);
        score += ratioScore * 0.3;
        
        // Keyword matching score (30% weight)
        const queryWords = query.toLowerCase().split(/\s+/);
        const mediaTitle = (media.title || '').toLowerCase();
        const matchingWords = queryWords.filter(word => mediaTitle.includes(word));
        const keywordScore = matchingWords.length / queryWords.length;
        score += keywordScore * 0.3;
        
        return score;
    }

    /**
     * Download media file to local storage
     * @param {Object} mediaInfo - Media information object
     * @returns {Promise<Object>} Downloaded media information
     */
    async downloadMedia(mediaInfo) {
        try {
            const fileExt = mediaInfo.type === 'video' ? 'mp4' : 'jpg';
            const fileName = `${mediaInfo.type}_${Date.now()}.${fileExt}`;
            const filePath = path.join(this.tempDir, fileName);

            await fs.promises.mkdir(this.tempDir, { recursive: true });

            const response = await fetch(mediaInfo.url);
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.statusText}`);
            }

            await pipeline(response.body, fs.createWriteStream(filePath));

            return {
                path: filePath,
                type: mediaInfo.type,
                metadata: {
                    width: mediaInfo.width,
                    height: mediaInfo.height,
                    duration: mediaInfo.duration,
                    source: mediaInfo.pixabayUrl,
                    creator: mediaInfo.photographer || mediaInfo.user
                }
            };
        } catch (error) {
            throw new Error(`Media download failed: ${error.message}`);
        }
    }

    /**
     * Process all scenes and download appropriate media
     * @param {Array} scenes - Array of scene objects
     * @returns {Promise<Array>} Array of downloaded media information
     */
    async processScenes(scenes) {
        const mediaFiles = [];

        for (const scene of scenes) {
            try {
                const mediaInfo = await this.getMediaForScene(scene);
                const downloadedMedia = await this.downloadMedia(mediaInfo);

                mediaFiles.push({
                    ...downloadedMedia,
                    sceneNumber: scene.sceneNumber,
                    duration: scene.duration?.estimatedDuration || downloadedMedia.metadata.duration
                });
            } catch (error) {
                console.error(`Error processing scene ${scene.sceneNumber}:`, error);
                continue;
            }
        }

        return mediaFiles;
    }

    /**
     * Clean up downloaded media files
     * @param {Array} mediaFiles - Array of media file paths
     */
    async cleanup(mediaFiles) {
        try {
            await Promise.all(
                mediaFiles.map(file => 
                    fs.promises.unlink(file.path).catch(err => 
                        console.warn(`Failed to delete ${file.path}:`, err)
                    )
                )
            );
            await fs.promises.rmdir(this.tempDir, { recursive: true }).catch(console.warn);
        } catch (error) {
            console.warn('Cleanup warning:', error);
        }
    }

}


module.exports = PixabayController;

