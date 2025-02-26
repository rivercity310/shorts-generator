const videoshow = require("videoshow");

class VideoCreator {
  static videoOptions = {
    fps: 30,
    loop: 3,   // seconds
    transition: true,
    transitionDuration: 1,  // seconds
    videoBitrate: 1024,
    videoCodec: 'libx264',
    format: 'mp4',
    pixelFormat: 'yuv420p'
  }

  static run(imagePaths, bgmPath, narrationPath, destinationPath) {
    videoshow(imagePaths, this.videoOptions)
      .audio(bgmPath)
      .save(destinationPath)
      .on('start', (comm) => {
        console.log(`ffmpeg process started: ${comm}`);
      })
      .on('error', (err, stdout, stderr) => {
        console.error(`Error: ${err}`);
        console.error(`ffmpeg stderr: ${stderr}`);
      })
      .on('end', (output) => {
        console.log(`ffmpeg process end: ${output}`);
      });
  }
}

module.exports = VideoCreator;