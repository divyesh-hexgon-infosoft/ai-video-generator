const dotenv = require('dotenv');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const say = require('say');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { promisify } = require('util');
const stream = require('stream');
const path = require('path'); // Added path module

dotenv.config();
const pipeline = promisify(stream.pipeline);

class VideoGenerator {
  constructor(pexelsApiKey) {
    this.pexelsApiKey = pexelsApiKey;
    // Use absolute path for temp directory
    // this.tempDir = path.join(process.cwd(), 'temp');
    this.tempDir = this.normalizePath(path.join(process.cwd(), 'temp'));
  }

  normalizePath(pathStr) {
    return pathStr.replace(/\\/g, '/');
  }

  parseScriptSections(script) {
    const lines = script.replace('[SCENE START]', '').trim().split('\n');
    const sections = [];
    let currentSection = null;

    for (let line of lines) {
      if (line.startsWith('**')) {
        if (currentSection) {
          currentSection.content = currentSection.content.trim();
          sections.push(currentSection);
        }

        const sectionMatch = line.match(/\*\*(.*?)\*\*:?(.*)/);
        if (sectionMatch) {
          let [, type, description] = sectionMatch;
          currentSection = {
            type: type.toLowerCase(),
            content: description.trim(),
            duration: 0
          };
        }
      } else if (currentSection && line.trim()) {
        currentSection.content += ' ' + line.trim();
      }
    }

    if (currentSection) {
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
    }

    sections.forEach(section => {
      section.duration = this.estimateDuration(section.content);
    });

    return sections;
  }

  estimateDuration(content) {
    const wordsPerMinute = 150;
    const wordCount = content.split(' ').length;
    return Math.ceil((wordCount / wordsPerMinute) * 60);
  }

  async getPexelsMedia(query, mediaType = 'photos', perPage = 5) {
    const baseUrl = mediaType === 'photos' 
      ? 'https://api.pexels.com/v1/search'
      : 'https://api.pexels.com/videos/search';

    const response = await fetch(
      `${baseUrl}?query=${query}&per_page=${perPage}`,
      { headers: { Authorization: this.pexelsApiKey } }
    );
    return response.json();
  }

  async downloadFile(url, filePath) {
    const absolutePath = path.resolve(filePath);
    const response = await fetch(url);
    await pipeline(response.body, fs.createWriteStream(absolutePath));
    return absolutePath;
  }

  createVoiceover(text, outputFile) {
    const absolutePath = path.resolve(outputFile);
    return new Promise((resolve, reject) => {
      say.export(text, null, 1.0, absolutePath, (err) => {
        if (err) {
          console.log("error in voiceover : ", err);
          reject(err);
        } 
        resolve(absolutePath);
      });
    });
  }

  async processSection(section) {
    const mediaFiles = [];
    const searchQuery = section.type;

    try {
      const [photos, videos] = await Promise.all([
        this.getPexelsMedia(searchQuery, 'photos', 2),
        this.getPexelsMedia(searchQuery, 'videos', 2)
      ]);

      if ((!photos?.photos?.length && !videos?.videos?.length)) {
        throw new Error(`No media found for query: ${searchQuery}`);
      }

      // Process photos with normalized paths
      for (const photo of photos.photos || []) {
        const filePath = this.normalizePath(path.join(this.tempDir, `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`));
        const absolutePath = await this.downloadFile(photo.src.original, filePath);
        mediaFiles.push({ 
          type: 'image',
          path: absolutePath,
          duration: Math.ceil(section.duration / 2)
        });
      }

      // Process videos with normalized paths
      for (const video of videos.videos || []) {
        const videoFile = video.video_files.find(f => 
          f.quality === 'sd' && f.width >= 720 && f.height >= 480
        );
        if (videoFile) {
          const filePath = this.normalizePath(path.join(this.tempDir, `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`));
          const absolutePath = await this.downloadFile(videoFile.link, filePath);
          mediaFiles.push({ 
            type: 'video', 
            path: absolutePath,
            duration: Math.ceil(section.duration / 2)
          });
        }
      }

      return mediaFiles;
    } catch (error) {
      console.error(`Error processing section ${section.type}:`, error);
      throw error;
    }
  }

async validateOutputPath(outputFile) {
    try {
      const absolutePath = path.resolve(outputFile);
      const outputDir = path.dirname(absolutePath);
      await fsPromises.mkdir(outputDir, { recursive: true });

      try {
        await fsPromises.access(absolutePath, fs.constants.W_OK);
        await fsPromises.unlink(absolutePath);
      } catch (error) {
        // File doesn't exist, which is fine
      }

      const testFile = path.join(outputDir, '.write_test');
      await fsPromises.writeFile(testFile, '');
      await fsPromises.unlink(testFile);

      return absolutePath;
    } catch (error) {
      throw new Error(`Cannot write to output location: ${error.message}`);
    }
  }

async validateAndPrepareOutputPath(outputFile) {
    try {
      const absolutePath = this.normalizePath(path.resolve(outputFile));
      const outputDir = this.normalizePath(path.dirname(absolutePath));

      await fsPromises.mkdir(outputDir, { recursive: true });

      const testFile = this.normalizePath(path.join(outputDir, '.write_test'));
      try {
        await fsPromises.writeFile(testFile, '');
        await fsPromises.unlink(testFile);
      } catch (error) {
        throw new Error(`No write permission in output directory: ${error.message}`);
      }

      try {
        await fsPromises.access(absolutePath);
        await fsPromises.unlink(absolutePath);
      } catch (error) {
        // File doesn't exist, which is fine
      }

      return absolutePath;
    } catch (error) {
      throw new Error(`Output path validation failed: ${error.message}`);
    }
  }

async createVideo(script, outputFile = 'final_video.mp4') {
    try {
      await fsPromises.mkdir(this.tempDir, { recursive: true, mode: 0o777 });

      const absoluteOutputPath = await this.validateAndPrepareOutputPath(outputFile);
      console.log('Validated output path:', absoluteOutputPath);

      const sections = this.parseScriptSections(script.generatedScript);
      const voiceoverPath = this.normalizePath(path.join(this.tempDir, `voiceover_${Date.now()}.wav`));
      const absoluteVoiceoverPath = await this.createVoiceover(
        sections.map(s => s.content).join(' '),
        voiceoverPath
      );

      const allMediaFiles = [];
      for (const section of sections) {
        const mediaFiles = await this.processSection(section);
        allMediaFiles.push(...mediaFiles);
      }

      if (allMediaFiles.length === 0) {
        throw new Error('No media files were processed successfully');
      }

      return new Promise((resolve, reject) => {
        let command = ffmpeg();

        // Add input files
        allMediaFiles.forEach((media, index) => {
          const absolutePath = this.normalizePath(path.resolve(media.path));
          if (media.type === 'image') {
            command = command
              .input(absolutePath)
              .inputOptions([`-loop 1`, `-t ${media.duration}`]);
          } else {
            command = command.input(absolutePath);
          }
        });

        // Add voiceover
        command.input(absoluteVoiceoverPath);

        // Build filter complex
        const filterComplex = [];
        allMediaFiles.forEach((_, index) => {
          filterComplex.push(
            `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}]`
          );
        });

        const scaledInputs = allMediaFiles.map((_, index) => `[v${index}]`).join('');
        filterComplex.push(`${scaledInputs}concat=n=${allMediaFiles.length}:v=1:a=0[vout]`);

        // Add audio
        filterComplex.push(`[${allMediaFiles.length}:a]anull[aout]`);

        command
          .complexFilter(filterComplex)
          .map('[vout]')
          .map('[aout]')
          .outputOptions([
            '-c:v libx264',
            '-preset medium',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-c:a aac',
            '-shortest',
            '-y'
          ])
          .on('start', commandLine => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', progress => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg stderr:', stderr);
            reject(new Error(`FFmpeg error: ${err.message}\nStderr: ${stderr}`));
          })
          .on('end', async () => {
            try {
              // Clean up temp files
              await Promise.all([
                ...allMediaFiles.map(f => fsPromises.unlink(this.normalizePath(path.resolve(f.path))).catch(console.error)),
                fsPromises.unlink(absoluteVoiceoverPath).catch(console.error)
              ]);
              await fsPromises.rmdir(this.tempDir).catch(console.error);
              resolve(absoluteOutputPath);
            } catch (error) {
              console.warn('Cleanup warning:', error);
              resolve(absoluteOutputPath);
            }
          })
          .save(this.normalizePath(absoluteOutputPath));
      });
    } catch (error) {
      console.error('Error in createVideo:', error);
      throw error;
    }
  }

}


module.exports = VideoGenerator;

