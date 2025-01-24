const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class VideoGeneratorController {
    constructor() {
        this.tempDir = path.join(process.cwd(), 'temp');
        this.outputDir = path.join(process.cwd(), 'output');
    }

    async verifyFile(filePath) {
        try {
            await fs.access(filePath);
            const stats = await fs.stat(filePath);
            console.log(`✅ File verified - Path: ${filePath}, Size: ${stats.size} bytes`);
            return true;
        } catch (error) {
            console.warn(`⚠️ File verification failed - Path: ${filePath}, Error: ${error.message}`);
            return false;
        }
    }

    async verifyVideoDuration(videoPath, expectedDuration) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const actualDuration = metadata.format.duration;
                console.log(`📊 Video duration check - Expected: ${expectedDuration}s, Actual: ${actualDuration}s`);

                // Allow 0.5 second tolerance
                if (Math.abs(actualDuration - expectedDuration) > 0.5) {
                    console.warn(`⚠️ Duration mismatch for ${videoPath}`);
                }

                resolve(actualDuration);
            });
        });
    }

    async getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) reject(err);
                else resolve(parseFloat(metadata.format.duration));
            });
        });
    }

    async stripAudioFromVideo(videoPath) {
        const outputPath = path.join(this.tempDir, `temp_${uuidv4()}_noaudio.mp4`);
        
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .outputOptions(['-c:v copy', '-an'])
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', reject)
                .run();
        });
    }

    async normalizeAudio(audioPaths, duration) {
        const outputPath = path.join(this.tempDir, `temp_${uuidv4()}_normalized_audio.mp3`);

        // Convert duration to a number if it isn't already
        const normalizedDuration = parseFloat(duration);
        
        if (isNaN(normalizedDuration)) {
            throw new Error(`Invalid duration value: ${duration}`);
        }

        console.log(`🎵 Normalizing audio with duration: ${normalizedDuration} seconds`);

        return new Promise((resolve, reject) => {
            let command = ffmpeg();

            audioPaths.forEach((audioPath, index) => {
                command.input(audioPath);
            });

            command
                .audioFilters([
                    'loudnorm=I=-16:LRA=11:TP=-1.5', // Normalize audio levels
                    'apad'  // Add padding to prevent audio cutoff
                ])
                .duration(normalizedDuration)
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log(`🎵 Starting audio normalization with command: ${commandLine}`);
                })
                .on('end', () => {
                    console.log('✅ Audio normalization complete');
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('❌ Audio normalization failed:', err);
                    reject(err);
                })
                .run();
        });
    }

    async generateSceneVideo(scene) {
        console.log(`🎬 Processing scene ${scene.sceneNumber}`);
        console.log(`Scene ${scene.sceneNumber} data:`, JSON.stringify(scene, null, 2));
    
        // Verify files exist
        const mediaExists = await this.verifyFile(scene.media.path);
        const audioExists = scene.audio ? await this.verifyFile(scene.audio.path) : false;
    
        if (!mediaExists) {
            console.error(`❌ Media file missing for scene ${scene.sceneNumber}`);
            return null;
        }
    
        const outputPath = path.join(this.tempDir, `scene_${scene.sceneNumber}_final.mp4`);
        let videoPath = scene.media.path;
        
        let videoDuration = 0;
        let audioDuration = 0;
        let finalDuration = 0;
    
        // 1. Determine media (video/image) duration
        try {
            if (scene.media.type === 'image') {
                // Use the specified image duration or default to 5s
                videoDuration = parseFloat(scene.media.duration) || 5;
            } else {
                // Retrieve actual video duration
                videoDuration = await this.getVideoDuration(videoPath);
            }
    
            if (isNaN(videoDuration) || videoDuration <= 0) {
                throw new Error(`Invalid media duration: ${videoDuration}`);
            }
        } catch (error) {
            console.error(`❌ Error calculating media duration for scene ${scene.sceneNumber}:`, error);
            throw error;
        }
    
        // 2. Determine audio duration (if audio exists)
        if (audioExists && scene.audio) {
            try {
                audioDuration = await this.getVideoDuration(scene.audio.path);
    
                // If there's audio, the final duration should match the audio length
                finalDuration = audioDuration;
            } catch (err) {
                console.error(`❌ Error calculating audio duration for scene ${scene.sceneNumber}:`, err);
                throw err;
            }
        } else {
            // If no audio, use the media duration
            finalDuration = videoDuration;
        }
    
        console.log(`\n📏 Video duration: ${videoDuration}s`);
        console.log(`📏 Audio duration: ${audioDuration ? audioDuration + 's' : 'No audio'}`);
        console.log(`✅ Final desired duration: ${finalDuration}s`);
    
        // 3. Process audio if exists (normalize and strip original video audio)
        let normalizedAudioPath = null;
        if (audioExists && scene.audio) {
            try {
                if (scene.audio.type === 'multiple' && Array.isArray(scene.audio.paths)) {
                    normalizedAudioPath = await this.normalizeAudio(scene.audio.paths, finalDuration);
                } else if (scene.audio.path) {
                    normalizedAudioPath = await this.normalizeAudio([scene.audio.path], finalDuration);
                }
    
                // Strip audio from original video if it's not an image
                if (scene.media.type !== 'image') {
                    videoPath = await this.stripAudioFromVideo(scene.media.path);
                }
            } catch (error) {
                console.error(`❌ Error processing audio for scene ${scene.sceneNumber}:`, error);
                throw error;
            }
        }
    
        // 4. Build ffmpeg command
        return new Promise((resolve, reject) => {
            let command = ffmpeg();
    
            // Handle image input separately
            if (scene.media.type === 'image') {
                // For images, we loop with `-loop 1` and set the final duration
                command
                    .input(videoPath)
                    .inputOptions(['-loop 1'])
                    .duration(finalDuration);
    
            } else {
                // For video input
                // If the final duration is longer than the original video, we loop the video
                // using `-stream_loop -1` until we reach finalDuration with `-t`.
                if (finalDuration > videoDuration) {
                    command.inputOptions(['-stream_loop -1']);
                }
                command.input(videoPath);
            }
    
            // If we have normalized audio, add it as an additional input
            if (normalizedAudioPath) {
                command.input(normalizedAudioPath);
            }
    
            // Build output options
            const outputOptions = [
                '-c:v libx264',
                '-preset medium',
                '-profile:v high',
                '-level 4.1',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-movflags +faststart',
                '-vsync 2',
                // Force the final length to match finalDuration (cuts or ends the loop)
                `-t ${finalDuration}`
            ];
    
            // If we have audio, encode and keep it in sync
            if (normalizedAudioPath) {
                outputOptions.push(
                    '-c:a aac',
                    '-b:a 192k',
                    '-shortest'
                );
            }
    
            // Apply video filters (scaling + padding to 1920x1080)
            command
                .outputOptions(outputOptions)
                .videoFilters([
                    'format=yuv420p',
                    'scale=1920:1080:force_original_aspect_ratio=decrease',
                    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2'
                ])
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log(`\n🎥 Processing scene ${scene.sceneNumber} with command:`);
                    console.log(commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`⏳ Scene ${scene.sceneNumber} processing: ${Math.round(progress.percent)}% done`);
                    }
                })
                .on('end', async () => {
                    try {
                        // Optional: verify the output video duration if needed
                        console.log(`✅ Scene ${scene.sceneNumber} processed successfully`);
                        // Resolve with path and finalDuration
                        resolve({ path: outputPath, duration: finalDuration });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    console.error(`❌ Error processing scene ${scene.sceneNumber}:`, err);
                    reject(err);
                })
                .run();
        });
    }
    

    async processScenes(scenes) {
        console.log(`🛠️ Processing ${scenes.length} scenes...`);
        const sceneVideos = await Promise.all(scenes.map(async (scene) => {
            try {
                return await this.generateSceneVideo(scene);
            } catch (error) {
                console.error(`❌ Scene ${scene.sceneNumber} failed:`, error.message);
                return null;
            }
        }));
        // Filter out any null results from failed scene processing
        return sceneVideos.filter(Boolean);
    }

    async combineSceneVideos(scenePaths, outputFileName) {
        console.log('🔄 Combining scenes into final video');
        const finalOutputPath = path.join(this.outputDir, `${outputFileName || 'final'}.mp4`);
        const concatFilePath = path.join(this.tempDir, 'concat.txt');

        try {
            // Create the concat file with explicit durations
            const fileList = await Promise.all(scenePaths.map(async (p) => {
                const duration = await this.getVideoDuration(p);
                return `file '${p}'\nduration ${duration}`;
            }));

            await fs.writeFile(concatFilePath, fileList.join('\n'));
            console.log('📝 Created concat file with durations:', fileList);

            // Calculate expected total duration
            const totalDuration = await Promise.all(scenePaths.map(p => this.getVideoDuration(p)))
                .then(durations => durations.reduce((sum, dur) => sum + dur, 0));

            return new Promise((resolve, reject) => {
                ffmpeg()
                    .input(concatFilePath)
                    .inputOptions([
                        '-f concat',
                        '-safe 0'
                    ])
                    .outputOptions([
                        '-c:v libx264',
                        '-preset medium',
                        '-crf 23',
                        '-c:a aac',
                        '-b:a 192k',
                        '-pix_fmt yuv420p',
                        '-movflags +faststart',
                        '-vsync 2'
                    ])
                    .output(finalOutputPath)
                    .on('start', (commandLine) => {
                        console.log('🎥 Starting final video combination with command:', commandLine);
                    })
                    .on('progress', (progress) => {
                        if (progress.percent) {
                            console.log(`⏳ Final video processing: ${Math.round(progress.percent)}% done`);
                        }
                    })
                    .on('end', async () => {
                        console.log('✅ Final video combination complete');
                        try {
                            // Verify final duration
                            const actualDuration = await this.getVideoDuration(finalOutputPath);
                            console.log(`📊 Final video duration: ${actualDuration}s (Expected: ${totalDuration}s)`);

                            if (Math.abs(actualDuration - totalDuration) > 1) {
                                console.warn('⚠️ Final video duration differs from expected duration');
                            }

                            resolve(finalOutputPath);
                        } catch (error) {
                            console.error('❌ Error verifying final duration:', error);
                            resolve(finalOutputPath);
                        }
                    })
                    .on('error', (err) => {
                        console.error('❌ Error combining videos:', err);
                        reject(err);
                    })
                    .run();
            });
        } catch (error) {
            console.error('❌ Error creating concat file:', error);
            throw error;
        }
    }

    async generateVideo(scenes) {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.mkdir(this.outputDir, { recursive: true });

            console.log('🎬 Starting video generation with scenes:', scenes.length);

            const sceneVideoPaths = await this.processScenes(scenes);

            if (sceneVideoPaths.length === 0) {
                throw new Error("No scenes processed successfully");
            }
            else{
                console.log("sceneVideoPaths : ",sceneVideoPaths);
            }

            const updatedScenesPaths =sceneVideoPaths.map((scene) => {
                // console.log("scene path : ",scenePath);
                // scenePath = scenePath.replace(/\\/g, '/');
                let fileName = path.basename(scene.path);
                scene.path = `http://localhost:3000/${fileName}`;
                console.log("scene path : ",scene);
                return scene;
            });

            // if (sceneVideoPaths.length === 0) {
            //     throw new Error("No scenes processed successfully");
            // }

            // console.log(`✅ Processed ${sceneVideoPaths} scenes successfully`);

            // const finalVideoPath = await this.combineSceneVideos(sceneVideoPaths, `video_${uuidv4()}`);
            // await this.verifyFile(finalVideoPath);

            console.log("final video path : ",updatedScenesPaths);

            return updatedScenesPaths;
        } catch (error) {
            console.error(`❌ Video generation failed: ${error.message}`);
            throw error;
        }
    }
}


module.exports = VideoGeneratorController;

