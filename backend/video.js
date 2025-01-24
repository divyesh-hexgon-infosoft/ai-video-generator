const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

// Use absolute paths to avoid path resolution issues
const rootDir = process.cwd();
const tempFolder = path.join(rootDir, 'temp');
const tempImagesFolder = path.join(rootDir, 'temp_images');
const outputFolder = path.join(rootDir, 'output');
const outputVideo = path.join(outputFolder, 'final_video.mp4');

async function createVideo() {
  try {
    // Ensure output and temp image folders exist
    await fs.ensureDir(outputFolder);
    await fs.ensureDir(tempImagesFolder);

    // Read all files in the temp folder
    const files = await fs.readdir(tempFolder);

    // Separate files by type
    const images = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
    const videos = files.filter(file => /\.(mp4|mkv|mov)$/i.test(file));
    const audio = files.find(file => /\.(mp3|wav)$/i.test(file));

    if (!images.length && !videos.length) {
      throw new Error('No images or videos found in the temp folder.');
    }

    if (!audio) {
      throw new Error('No audio file found in the temp folder.');
    }

    console.log('Images:', images);
    console.log('Videos:', videos);
    console.log('Audio:', audio);

    const slideshowVideo = path.join(outputFolder, 'slideshow.mp4');
    const concatenatedVideo = path.join(outputFolder, 'concatenated.mp4');

    // Step 1: Rename and copy images sequentially to a temp folder
    await Promise.all(
      images.map(async (image, index) => {
        const ext = path.extname(image);
        const newName = `${index + 1}${ext}`;
        const sourcePath = path.join(tempFolder, image);
        const destPath = path.join(tempImagesFolder, newName);
        await fs.copy(sourcePath, destPath);
      })
    );

    // Step 2: Create image list file for slideshow
    const imageListFile = path.join(outputFolder, 'image_list.txt');
    let imageList = '';
    images.forEach((_, index) => {
      const imagePath = path.join(tempImagesFolder, `${index + 1}${path.extname(images[index])}`).replace(/\\/g, '/');
      imageList += `file '${imagePath}'\nduration 5\n`;
    });
    const lastImagePath = path.join(tempImagesFolder, `${images.length}${path.extname(images[images.length - 1])}`).replace(/\\/g, '/');
    imageList += `file '${lastImagePath}'\n`;

    await fs.writeFile(imageListFile, imageList, 'utf8');
    console.log('Image list file created at:', imageListFile);
    console.log('Image list content:', imageList);

    // Step 3: Create slideshow video
    if (images.length) {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(imageListFile)
          .inputOptions(['-f concat', '-safe 0', '-protocol_whitelist file,pipe'])
          .outputOptions(['-vsync vfr', '-pix_fmt yuv420p', '-movflags +faststart'])
          .videoCodec('libx264')
          .save(slideshowVideo)
          .on('start', commandLine => console.log('FFmpeg command:', commandLine))
          .on('progress', progress => console.log('Processing: ', progress.percent, '% done'))
          .on('end', resolve)
          .on('error', err => reject(new Error(`FFmpeg error: ${err.message}`)));
      });
      console.log('Slideshow video created at:', slideshowVideo);
    }

    // Step 4: Concatenate videos
    if (videos.length) {
      const videoListFile = path.join(outputFolder, 'video_list.txt');
      const videoList = videos
        .map(video => `file '${path.join(tempFolder, video).replace(/\\/g, '/')}'`)
        .join('\n');

      await fs.writeFile(videoListFile, videoList);
      console.log('Video list file created at:', videoListFile);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoListFile)
          .inputFormat('concat')
          .inputOptions(['-safe 0', '-protocol_whitelist file,pipe'])
          .outputOptions('-c copy')
          .save(concatenatedVideo)
          .on('start', commandLine => console.log('FFmpeg command:', commandLine))
          .on('progress', progress => console.log('Processing: ', progress.percent, '% done'))
          .on('end', resolve)
          .on('error', err => reject(new Error(`FFmpeg error: ${err.message}`)));
      });
      console.log('Concatenated video created at:', concatenatedVideo);
    }

    // Step 5: Merge slideshow, concatenated video, and audio
    await new Promise((resolve, reject) => {
      const mainVideo = images.length ? slideshowVideo : concatenatedVideo;
      const ffmpegCommand = ffmpeg();

      // Add the main video (either slideshow or concatenated video)
      ffmpegCommand.input(mainVideo);

      // Add concatenated video if both images and videos exist
      if (images.length && videos.length) {
        ffmpegCommand.input(concatenatedVideo);
      }

      // Add audio
      ffmpegCommand.input(path.join(tempFolder, audio));

      ffmpegCommand
        .outputOptions(['-c:v libx264', '-c:a aac', '-strict experimental', '-movflags +faststart'])
        .save(outputVideo)
        .on('start', commandLine => console.log('Final FFmpeg command:', commandLine))
        .on('progress', progress => console.log('Processing final video: ', progress.percent, '% done'))
        .on('end', resolve)
        .on('error', err => reject(new Error(`FFmpeg error: ${err.message}`)));
    });

    console.log(`Final video created at: ${outputVideo}`);
  } catch (error) {
    console.error('Error creating video:', error.message);
    throw error;
  }
}

createVideo().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
