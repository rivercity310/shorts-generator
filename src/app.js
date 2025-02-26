require("dotenv").config();

// Default Libs
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

// Custom Libs
const VideoCreator = require("./VideoCreator");
const { DateUtil } = require('./utils');
const { GOOGLE_API, OPENAI_API } = require('./const');

// FFmpeg Libs
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Third party Libs
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: OPENAI_API.KEY })

const app = express();
app.use(express.json({ limit: "50mb"}));  // JSON 본문 크기 제한 증가
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

async function generateVoiceSynthesisMP3File(basePath, text) {
  const url = path.join(GOOGLE_API.ENDPOINT, "/v1beta1/text:synthesize");

  const data = await fetch(url, {
    method: "POST",
    headers: {
      "X-goog-api-key": GOOGLE_API.KEY
    },
    body: JSON.stringify({
      /* Input (Required)
       * - The Synthesizer requires either plain text or SSML as input.
       * - value object is SynthesisInput
       * */
      input: {
        /* SynthesisInput
         * - Contains text input to be synthesized. (Either Text or SSML must be supplied)
         * - The Input size is limited to 5000 bytes.
         */

        customPronunciations: {
          /* CustomPronunciations (Optional)
           * - The pronunciation customizations are applied to the input.
           * - If this is set, the input is synthesized using the given pronunciation customizations.
           * - The initial support is for English, French, Italian, German, and Spanish
           */
        },

        text: text  /* The raw text to be synthesized */
      },

      /* VoiceSelectionParams (Required)
       * The desired voice of the synthesized audio.
       */
      voice: {
        languageCode: "ko-KR",    /* Required! */
        name: "ko-KR-Wavenet-D"  /* The name of the voice */
      },

      /* AudioConfig (Required)
       * - The configuration of the synthesized audio.
       */
      audioConfig: {
        audioEncoding: "mp3",  /* The format of the audio byte stream (ENUM) */
        speakingRate: 1,       /* Speaking rate/speed in the range [0.25, 4.0]. 1.0 is the normal native speed */
        pitch: 5,             /* Speaking pitch in the range [-20.0, 20.0]. 0 is the normal native pitch */
        volumeGainDb: 10,      /* Volume in the range [-96.0, 16.0]. 0 is normal volume */
        sampleRateHertz: 12000
      },
      /*
      enableTimePointing: {

      },
      advancedVoiceOptions: {

      }
      */
    })
  });

  const json = await data.json();

  // 응답이 성공하면 "audioContent" 키에 요청시 지정한대로 Base64 인코딩된 데이터 바이트가 실려옴.
  // Data Bytes -> MP3 파일로 변환
  if ("audioContent" in json) {
    const encodedText = json.audioContent;
    const audioBuffer = Buffer.from(encodedText, "base64");  /* Base64 -> Buffer 변환 */

    // 파일로 저장
    const filePath = path.join(basePath, "voice.mp3");
    fs.writeFileSync(filePath, audioBuffer);

    return filePath;
  }

  return null;
}

async function generateAnimationImage(basePath, i, text) {
  const prompt = `
    1. 아래 주어진 텍스트를 읽고 키워드를 파악해서 관련된 이미지를 애니메이션 느낌으로 생성해주세요.
    2. 만약 생성된 이미지가 텍스트를 포함한다면 전부 한국어로 작성해주세요.
    ---
    "${text}"
  `

  const res = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024"
  });

  const url = res.data[0].url;
  const imagePath = path.join(basePath, `test-${i}.png`);

  // 생성된 이미지 저장하기
  try {
    const imageRes = await fetch(url);
    const fileStream = fs.createWriteStream(imagePath, { flags: 'wx' });
    await finished(Readable.fromWeb(imageRes.body).pipe(fileStream));
  } catch (err) {
    console.error(err);
    return null;
  }

  return imagePath;
}

app.post("/", async (req, res) => {
  // 오늘자 폴더가 생성되어 있는지 확인
  const CWD = process.cwd();
  const todayPath = path.join("contents", DateUtil.getTodayKSTString());
  if (!fs.existsSync(todayPath)) fs.mkdirSync(todayPath);

  // 요청당 "HH-MM-DD" 이름의 폴더가 생성됨
  // 해당 폴더 내부에는 voice.mp3, image-${i}.png 파일 및 최종 숏츠 영상이 저장됨.
  const basePath = path.join(CWD, "contents", "2025-02-26", "14h20m38s")// path.join(todayPath, DateUtil.getCurrentKSTTime());
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath);

  const { inputText } = req.body;
  const imageListPath = [];

  // FFmpeg을 이용해서 이미지와 배경음악, 내레이션을 합성 -> mp4 영상 파일 생성
  // 0. 경로 정의
  // const narrationPath = await generateVoiceSynthesisMP3File(basePath, inputText);
  // const imagePath = await generateAnimationImage(basePath, 0, inputText);
  const narrationPath = path.join(basePath, "voice.mp3");
  const imagePath = path.join(basePath, "test-0.png");
  const bgmPath = path.join(CWD, "bgm", "bgm.mp3");
  const outputVideoPath = path.join(basePath, "output.mp4");
  const slideshowVideoPath = path.join(basePath, 'slideshow.mp4');
  const mixedAudioPath = path.join(basePath, 'mixed-audio.mp3');
  imageListPath.push(imagePath);
  imageListPath.push(path.join(basePath, "test-1.png"));

  VideoCreator.run(imageListPath, bgmPath, narrationPath, outputVideoPath);

  /*
  // 1. 이미지 리스트 -> 슬라이드쇼 영상 변환
  await new Promise((resolve, reject) => {
    const slideshow = ffmpeg();
    imageListPath.forEach(imagePath => slideshow.input(imagePath));

    slideshow
      .inputOptions('-framerate 3')  // 각 이미지당 1초
      .outputOptions('-pix_fmt yuv420p')  // 호환성 높은 포맷
      .output(slideshowVideoPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // 2. 내레이션 mp3 파일과 bgm mp3 파일 믹싱
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(narrationPath)
      .input(bgmPath)
      .complexFilter([
        '[0:a]volume=1[a1];',   // 내레이션 볼륨 유지
        '[1:a]volume=0.3[a2];', // 배경음악 볼륨 낮춤
        '[a1][a2]amix=inputs=2:duration=longest:dropout_transition=3[mixed]' // 믹싱 결과를 [mixed]로 명시
      ])
      .outputOptions('-map [mixed]') // 최종 믹싱된 오디오를 출력으로 지정
      .outputOptions('-c:a aac', '-b:a 192k')  // 오디오 코덱과 비트레이트 설정
      .output(mixedAudioPath)
      .on('end', resolve)
      .on('error', (err, stdout, stderr) => {
        console.log(`FFmpeg Error: ${err}`);
        console.log(`FFmpeg stderr: ${stderr}`);
        reject(err);
      })
      .run();
  });

  // 3. 영상 + 오디오 믹싱
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(slideshowVideoPath)
      .input(mixedAudioPath)
      .outputOptions('-c:v copy', '-c:a aac', '-shortest')  // 오디오 길이에 맞춰 영상 조정
      .output(outputVideoPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  */

  return res.status(200).end();
})

app.listen(8000, () => {
  console.log("App listening on port 8000");
});