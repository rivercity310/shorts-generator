const videoshow = require("videoshow");
const path = require("path");
const { exec } = require("child_process");

class FFmpeg {
  static FFMPEG = path.resolve(process.cwd(), "ffmpeg", "bin", "ffmpeg.exe");

  static videoOptions = {
    fps: 30,
    loop: 5,   // seconds
    transition: true,
    transitionDuration: 0.5,  // seconds
    videoBitrate: 1024,
    videoCodec: 'libx264',
    audioBitrate: '128k',
    audioChannels: 2,
    format: 'mp4',
    pixelFormat: 'yuv420p'
  }

  static mergeAudioStreams(outputPath, voicePath, bgmPath) {
    const cmd = `${this.FFMPEG} -i ${voicePath} -i ${bgmPath} -filter_complex "[0:a]volume=1.5[a1];[1:a]volume=0.8[a2];[a1][a2]amix=inputs=2:duration=shortest[a]" -map "[a]" ${outputPath}`
    console.log(cmd);

    // FFmpeg 프로세스 실행
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error mixing audio: ${error.message}`);
        console.error(`ffmpeg stderr: ${stderr}`);
        return;
      }
      console.log('Audio Mixing Completed Successfully', stdout);
    });
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