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

    async generateSceneVideo(scene) {
        console.log(`🎬 Processing scene ${scene.sceneNumber}`);
        const mediaExists = await this.verifyFile(scene.media.path);
        const audioExists = await this.verifyFile(scene.audio.path);
        if (!mediaExists) return null; // Skip if media missing

        const outputPath = path.join(this.tempDir, `scene_${scene.sceneNumber}_final.mp4`);
        let videoPath = scene.media.path;

        if (scene.media.type !== 'image' && audioExists) {
            videoPath = await this.stripAudioFromVideo(scene.media.path);
        }

        return new Promise((resolve, reject) => {
            let command = ffmpeg(videoPath);
            if (scene.media.type === 'image') {
                command.loop(1).duration(scene.media.duration || 5);
            }
            if (audioExists) command.input(scene.audio.path);

            command
                .outputOptions([
                    '-c:v libx264', '-pix_fmt yuv420p', '-movflags +faststart',
                    '-shortest', '-c:a aac', '-b:a 192k'
                ])
                .size('1920x1080')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', reject)
                .run();
        });
    }

    async processScenes(scenes) {
        console.log(`🛠️ Processing ${scenes.length} scenes...`);
        const sceneVideoPaths = await Promise.all(scenes.map(async (scene) => {
            try {
                return await this.generateSceneVideo(scene);
            } catch (error) {
                console.error(`❌ Scene ${scene.sceneNumber} failed:`, error.message);
                return null;
            }
        }));
        return sceneVideoPaths.filter(Boolean);
    }

    async combineSceneVideos(scenePaths, outputFileName) {
        console.log("conbine scene videos data : ",scenePaths);
        console.log('🔄 Combining scenes into final video');
        const finalOutputPath = path.join(this.outputDir, `${outputFileName || 'final'}.mp4`);
        const concatFilePath = path.join(this.tempDir, 'concat.txt');
        await fs.writeFile(concatFilePath, scenePaths.map(p => `file '${p}'`).join('\n'));

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(concatFilePath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions([
                    '-c:v libx264', '-preset slow', '-crf 22', '-c:a aac', '-b:a 192k',
                    '-pix_fmt yuv420p', '-movflags +faststart'
                ])
                .output(finalOutputPath)
                .on('end', () => resolve(finalOutputPath))
                .on('error', reject)
                .run();
        });
    }

    async generateVideo(scenes) {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.mkdir(this.outputDir, { recursive: true });

            const sceneVideoPaths = await this.processScenes(scenes);
            if (sceneVideoPaths.length === 0) throw new Error("No scenes processed");

            const finalVideoPath = await this.combineSceneVideos(sceneVideoPaths, `video_${uuidv4()}`);
            await this.verifyFile(finalVideoPath);

            // console.log('🧹 Cleaning up temporary files');
            // await Promise.all(sceneVideoPaths.map(async (scenePath) => fs.unlink(scenePath).catch(() => {})));

            return finalVideoPath;
        } catch (error) {
            console.error(`❌ Video generation failed: ${error.message}`);
            throw error;
        }
    }

}


module.exports = VideoGeneratorController;

