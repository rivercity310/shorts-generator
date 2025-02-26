const ffmpeg = require("fluent-ffmpeg");
const videoshow = require("videoshow");

class FFmpeg {
  static videoOptions = {
    fps: 30,
    loop: 3,   // seconds
    transition: true,
    transitionDuration: 1,  // seconds
    videoBitrate: 1024,
    videoCodec: 'libx264',
    audioBitrate: '128k',
    audioChannels: 2,
    format: 'mp4',
    pixelFormat: 'yuv420p'
  }

  static mergeAudioStreams(outputPath, ...inputPaths) {
    const cmd = ffmpeg();

    // select audio from each input
    inputPaths.forEach((path, index) => cmd.input(path));

    cmd
      .complexFilter([
        {
          filter: 'amix',
          options: { inputs: 2, duration: 'shortest' },
          outputs: 'mixed'
        }
      ])
      .outputOptions('-map [mixed]')
      .output(outputPath)
      .on('end', () => console.log('Audio Mixing Completed\n'))
      .on('error', (err) => console.error(`Audio Mixing Error: ${err}\n`))
      .run()
  }

  static async run(imagePaths, mixedAudioPath, destinationPath) {
    console.log("Audio & Video Mixing process started");

    return new Promise((resolve, reject) => {
      videoshow(imagePaths, this.videoOptions)
        .audio(mixedAudioPath)
        .save(destinationPath)
        .on('start', (comm) => {
          console.log(`ffmpeg process started: ${comm}`);
        })
        .on('error', (err, stdout, stderr) => {
          console.error(`Error: ${err}`);
          console.error(`ffmpeg stderr: ${stderr}`);
          reject(err);
        })
        .on('end', (output) => {
          console.log(`ffmpeg process end: ${output}`);
          resolve(output);
        });
    })
  }
}

module.exports = FFmpeg;