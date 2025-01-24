const wizard = require('./scriptWizard.controller');
const PexelsController = require('./pexels.controller');
const { spawn } = require('child_process');
const { promisify } = require('util');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const fs = require('fs').promises;
const path = require('path');
const gTTS = require('gtts');
const VideoGeneratorController = require('./video.generator.controller');
require('dotenv').config();
const PixabayController = require('../controllers/pixabay.controller');

exports.generateScript = async (req, res) => {
    try {
        const { prompt, options } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        const result = await wizard.generateScript(prompt, options);
        res.json(result);
    } catch (error) {
        console.log("error is", error);
        res.status(500).json({ error: error.message });
    }
}

exports.generateVideoScript = async (req, res) => {
    try {
        const { prompt } = req.body;
        const options = {
            style: 'professional',
            tone: 'engaging',
            duration: '2 minutes',
            format: 'video script'
        };
        const result = await wizard.generateScript(prompt, options);
        res.json(result);        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Helper function to generate audio for a scene
// const generateSceneAudio = async (scene, sceneNumber) => {
//     return new Promise((resolve, reject) => {
//         const outputPath = path.join(__dirname, '../public/audio', `scene_${sceneNumber}.wav`);

//         const sayProcess = spawn('say', [
//             '-v', 'Alex',  // You can change the voice as needed
//             '-o', outputPath,
//             scene.script
//         ]);

//         sayProcess.on('error', (error) => {
//             reject(error);
//         });

//         sayProcess.on('close', (code) => {
//             if (code === 0) {
//                 resolve({
//                     path: outputPath,
//                     sceneNumber: sceneNumber,
//                     type: 'audio/wav'
//                 });
//             } else {
//                 reject(new Error(`Audio generation process exited with code ${code}`));
//             }
//         });
//     });
// };

// const generateSceneAudio = async (scene, sceneNumber) => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             const outputPath = path.join(__dirname, '../public/audio', `scene_${sceneNumber}.wav`);

//             // Ensure the audio directory exists
//             await fs.mkdir(path.join(__dirname, '../public/audio'), { recursive: true });

//             // Create the synthesizer
//             const speechConfig = sdk.SpeechConfig.fromSubscription('', '');  // Empty strings for free usage
//             speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

//             // Set audio output format
//             const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);

//             const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

//             synthesizer.speakTextAsync(
//                 scene.script,
//                 result => {
//                     if (result) {
//                         resolve({
//                             path: outputPath,
//                             sceneNumber: sceneNumber,
//                             type: 'audio/wav'
//                         });
//                     }
//                     synthesizer.close();
//                 },
//                 error => {
//                     console.log(error);
//                     synthesizer.close();
//                     reject(error);
//                 }
//             );
//         } catch (error) {
//             console.error('Error generating audio:', error);
//             reject(error);
//         }
//     });
// };

const generateSceneAudio = async (scene, sceneNumber) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("generate scene audio : ",scene,sceneNumber);
            const outputPath = path.join(__dirname, '../temp', `scene_${sceneNumber}.mp3`);

            // Ensure the audio directory exists
            await fs.mkdir(path.join(__dirname, '../temp'), { recursive: true });

            // Create gTTS instance
            const gtts = new gTTS(scene.text, 'en');

            // Save to file
            gtts.save(outputPath, (err) => {
                if (err) {
                    console.error('Error saving audio:', err);
                    reject(err);
                    return;
                }
                resolve({
                    path: outputPath,
                    sceneNumber: sceneNumber,
                    type: 'audio/mp3'
                });
            });
        } catch (error) {
            console.error('Error generating audio:', error);
            reject(error);
        }
    });
};


exports.generateScriptWithMedia = async (req, res) => {
    try {
        const { prompt, options } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // 1. Generate script
        const scriptResult = await wizard.generateScript(prompt, options);

        // 2. Initialize controllers
        const pexelsController = new PexelsController(process.env.PEXELS_API_KEY);
        const pixabayController = new PixabayController(process.env.PIXABAY_API_KEY);
        const videoGenerator = new VideoGeneratorController();

        // 3. Process scenes and get media in parallel with audio generation
        // const [mediaFiles, audioFiles] = await Promise.all([
        //     pexelsController.processScenes(scriptResult.scenes),
        //     Promise.all(scriptResult.scenes.map((scene, index) => 
        //         generateSceneAudio(scene, index + 1)
        //     ))
        // ]);

        const [mediaFiles, audioFiles] = await Promise.all([
            pixabayController.processScenes(scriptResult.scenes),
            Promise.all(scriptResult.scenes.map((scene, index) => 
                generateSceneAudio(scene, index + 1)
            ))
        ]);

        // 4. Add media and audio information to scenes
        const enhancedScenes = scriptResult.scenes.map((scene, index) => ({
            ...scene,
            media: mediaFiles[index] || null,
            audio: audioFiles[index] || null,
            sceneNumber: index + 1
        }));

        // 5. Generate videos for each scene and combine them
        console.log('Starting video generation...');
        const videoScenePath = await videoGenerator.generateVideo(enhancedScenes);
        // console.log('Video generation completed:', finalVideoPath);

        // // Extract filename and last folder name
        // const pathParts = finalVideoPath.split('\\');
        // const lastFolderName = pathParts[pathParts.length - 2]; // Get last folder name
        // const fileName = pathParts.pop(); // Get filename

        // // Construct new path
        // const host = 'http://localhost:3000'; // Replace with your actual host
        // const newPath = `${host}/${fileName}`; // New path

        // 6. Clean up temporary media and audio files, but keep the final video
        // await Promise.all([
        //     pexelsController.cleanup(mediaFiles),
        //     Promise.all(audioFiles.map(file => fs.unlink(file.path).catch(console.warn))),
        //     // videoGenerator.cleanup(finalVideoPath)
        // ]);

        // 7. Prepare final response
        const response = {
            ...scriptResult,
            scenes: enhancedScenes,
            mediaFiles: mediaFiles.map(file => ({
                path: file.path,
                type: file.type,
                metadata: file.metadata,
                sceneNumber: file.sceneNumber,
                duration: file.duration
            })),
            audioFiles: audioFiles.map(file => ({
                path: file.path,
                type: file.type,
                sceneNumber: file.sceneNumber
            })),
            videoScenePath
        };

        res.json(response);

    } catch (error) {
        console.error("Error in generateScriptWithMedia:", error);
        // Clean up any temporary files in case of error
        try {
            const tempDir = path.join(process.cwd(), 'temp');
            await fs.rmdir(tempDir, { recursive: true }).catch(console.warn);
        } catch (cleanupError) {
            console.warn("Error during cleanup:", cleanupError);
        }
        res.status(500).json({ error: error.message });
    }
}

// New route handler specifically for getting media for existing script
exports.getMediaForScript = async (req, res) => {
    try {
        const { scenes } = req.body;

        if (!scenes || !Array.isArray(scenes)) {
            return res.status(400).json({ error: 'Valid scenes array is required' });
        }

        const pexelsController = new PexelsController(process.env.PEXELS_API_KEY);
        const mediaFiles = await pexelsController.processScenes(scenes);

        res.json({
            success: true,
            mediaFiles: mediaFiles.map(file => ({
                path: file.path,
                type: file.type,
                metadata: file.metadata,
                sceneNumber: file.sceneNumber,
                duration: file.duration
            }))
        });

    } catch (error) {
        console.error("Error in getMediaForScript:", error);
        res.status(500).json({ error: error.message });
    }
}

// Optional: Clean up media files after they're no longer needed
exports.cleanupMedia = async (req, res) => {
    try {
        const { mediaFiles, audioFiles } = req.body;

        if ((!mediaFiles || !Array.isArray(mediaFiles)) && (!audioFiles || !Array.isArray(audioFiles))) {
            return res.status(400).json({ error: 'Valid mediaFiles or audioFiles array is required' });
        }

        const pexelsController = new PexelsController(process.env.PEXELS_API_KEY);

        // Cleanup tasks in parallel
        await Promise.all([
            // Clean up media files
            mediaFiles ? pexelsController.cleanup(mediaFiles) : Promise.resolve(),
            // Clean up audio files
            audioFiles ? Promise.all(audioFiles.map(file => fs.unlink(file.path))) : Promise.resolve()
        ]);

        res.json({ success: true, message: 'Media and audio files cleaned up successfully' });

    } catch (error) {
        console.error("Error in cleanupMedia:", error);
        res.status(500).json({ error: error.message });
    }

}
