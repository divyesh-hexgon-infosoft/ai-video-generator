const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

class PexelsController {

    constructor(apiKey) {
        this.apiKey = apiKey;
        this.tempDir = path.join(process.cwd(), 'temp');
        // Define target dimensions for consistency
        this.targetDimensions = {
            width: 1920,
            height: 1080
        };
    }

    /**
     * Search for an image on Pexels with specific dimensions
     * @param {string} query - Search query
     * @returns {Promise<Object>} Image details
     */
    async searchImage(query) {
        try {
            // Request more images to increase chances of finding one with right dimensions
            const response = await fetch(
                `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape`,
                { headers: { Authorization: this.apiKey } }
            );
            const data = await response.json();

            if (!data.photos || data.photos.length === 0) {
                throw new Error(`No images found for query: ${query}`);
            }

            // Filter photos to find ones matching our target dimensions or close to it
            const suitablePhotos = data.photos.filter(photo => {
                // Calculate aspect ratio difference
                const targetRatio = this.targetDimensions.width / this.targetDimensions.height;
                const photoRatio = photo.width / photo.height;
                const ratioDifference = Math.abs(targetRatio - photoRatio);
                
                // Check if dimensions are at least HD quality
                const isHDQuality = photo.width >= 1920 && photo.height >= 1080;
                
                // Accept photos with similar aspect ratio and HD quality
                return ratioDifference < 0.1 && isHDQuality;
            });

            if (suitablePhotos.length === 0) {
                console.log(`No photos with target dimensions found for query: ${query}. Falling back to best available.`);
                // Fall back to the highest resolution landscape photo
                suitablePhotos.push(data.photos.reduce((best, current) => {
                    return (current.width > best.width) ? current : best;
                }, data.photos[0]));
            }

            const photo = suitablePhotos[0];
            console.log(`Selected photo dimensions: ${photo.width}x${photo.height}`);

            return {
                type: 'image',
                url: photo.src.original,
                width: photo.width,
                height: photo.height,
                photographer: photo.photographer,
                pexelsUrl: photo.url,
                aspectRatio: photo.width / photo.height
            };
        } catch (error) {
            throw new Error(`Image search failed: ${error.message}`);
        }
    }

    /**
     * Search for a video on Pexels with specific dimensions
     * @param {string} query - Search query
     * @returns {Promise<Object>} Video details
     */
    async searchVideo(query) {
        try {
            const response = await fetch(
                `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
                { headers: { Authorization: this.apiKey } }
            );
            const data = await response.json();

            if (!data.videos || data.videos.length === 0) {
                throw new Error(`No videos found for query: ${query}`);
            }

            // Filter videos to match target dimensions
            const suitableVideos = data.videos.filter(video => {
                const videoFile = video.video_files.find(f => 
                    f.width === this.targetDimensions.width && 
                    f.height === this.targetDimensions.height &&
                    (f.quality === 'hd' || f.quality === 'fhd')
                );
                return videoFile !== undefined;
            });

            let video = null;
            let videoFile = null;

            if (suitableVideos.length > 0) {
                video = suitableVideos[0];
                videoFile = video.video_files.find(f => 
                    f.width === this.targetDimensions.width && 
                    f.height === this.targetDimensions.height
                );
            } else {
                console.log(`No videos with exact dimensions found for query: ${query}. Finding best alternative.`);
                video = data.videos[0];
                // Find the highest quality video file that's at least 1080p
                videoFile = video.video_files
                    .filter(f => f.width >= 1920 && f.height >= 1080)
                    .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] 
                    || video.video_files[0]; // Fallback to first available if no suitable quality found
            }

            if (!videoFile) {
                throw new Error('No suitable video file available');
            }

            console.log(`Selected video dimensions: ${videoFile.width}x${videoFile.height}`);

            return {
                type: 'video',
                url: videoFile.link,
                width: videoFile.width,
                height: videoFile.height,
                duration: video.duration,
                user: video.user,
                pexelsUrl: video.url,
                aspectRatio: videoFile.width / videoFile.height
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

            const { visualDescription, mediaType, searchKeywords } = scene;
            const searchQuery = visualDescription;
            console.log("get media for scene : ", scene, searchQuery);

            // Try primary media type first
            try {
                if (mediaType === 'video') {
                    return await this.searchVideo(searchQuery);
                } else {
                    return await this.searchImage(searchQuery);
                }
            } catch (primaryError) {
                console.log(`Primary search failed (${mediaType}), trying fallback...`);
                
                // If primary search fails, try the other media type
                try {
                    if (mediaType === 'video') {
                        return await this.searchImage(searchQuery);
                    } else {
                        return await this.searchVideo(searchQuery);
                    }
                } catch (fallbackError) {
                    // If both searches fail, throw comprehensive error
                    throw new Error(
                        `Failed to find any media. Primary (${mediaType}): ${primaryError.message}. ` +
                        `Fallback: ${fallbackError.message}`
                    );
                }
            }
        } catch (error) {
            throw new Error(`Failed to get media for scene: ${error.message}`);
        }
    }

    /**
     * Download media file to local storage
     * @param {Object} mediaInfo - Media information object
     * @returns {Promise<string>} Path to downloaded file
     */

    async downloadMedia(mediaInfo) {
        try {
            const fileExt = mediaInfo.type === 'video' ? 'mp4' : 'jpg';
            const fileName = `${mediaInfo.type}_${Date.now()}.${fileExt}`;
            const filePath = path.join(this.tempDir, fileName);

            // Ensure temp directory exists
            await fs.promises.mkdir(this.tempDir, { recursive: true });

            // Download the file
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
                    source: mediaInfo.pexelsUrl,
                    creator: mediaInfo.photographer || mediaInfo.user?.name
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
                // Get media based on scene requirements
                const mediaInfo = await this.getMediaForScene(scene);

                // Download the media
                const downloadedMedia = await this.downloadMedia(mediaInfo);

                mediaFiles.push({
                    ...downloadedMedia,
                    sceneNumber: scene.sceneNumber,
                    duration: scene.duration?.estimatedDuration || downloadedMedia.metadata.duration
                });

            } catch (error) {
                console.error(`Error processing scene ${scene.sceneNumber}:`, error);
                // Continue with next scene if one fails
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

module.exports = PexelsController;

