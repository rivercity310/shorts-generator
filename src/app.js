require("dotenv").config();

// Default Libs
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

// Custom Libs
const FFMpeg = require("./FFmpeg");
const { DateUtil, TextUtil } = require('./utils');
const { GOOGLE_API, OPENAI_API } = require('./const');

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
          audioEncoding: "mp3",
          effectsProfileId: [
            "handset-class-device"
          ],
          pitch: 0,
          speakingRate: 1.15
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
  const imagePath = path.join(basePath, `test-${i}.png`);
  const prompt = `
    '---' 아래 주어진 텍스트를 읽고 핵심 키워드를 파악해서 관련된 이미지를 생성해주세요.
    ---
    "${text}"
  `
  try {
    const res = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024"
    });

    const url = res.data[0].url;

   // 생성된 이미지 저장하기
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
  if (!fs.existsSync(todayPath)) {
    fs.mkdirSync(todayPath);
  }

  // 요청당 "HH-MM-DD" 이름의 폴더가 생성됨
  // 해당 폴더 내부에는 voice.mp3, image-${i}.png 파일 및 최종 숏츠 영상이 저장됨.
  const basePath = path.join(todayPath, DateUtil.getCurrentKSTTime());
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  const { inputText } = req.body;
  const filteredText = TextUtil.filterText(inputText);
  const voicePath = "contents/2025-02-26/18h37m54s/voice.mp3" // await generateVoiceSynthesisMP3File(basePath, filteredText);
  const mixedAudioPath = path.join(basePath, 'mixed-audio.mp3');
  const bgmPath = path.join(CWD, "bgm", "bgm.mp3");

  console.log(`[Filtering text]\n${filteredText}\n\n`);

  // FFmpeg을 이용해서 이미지와 배경음악, 내레이션을 합성 -> mp4 영상 파일 생성
  try {
    // 1. 내레이션과 bgm 두 오디오 파일 합성하기
    FFMpeg.mergeAudioStreams(mixedAudioPath, voicePath, bgmPath);

    // 2. 이미지 생성
    const inputTextList = TextUtil.toStringArray(filteredText);

    // 개발중 임시 이미지 사용 경로
    const imageListPath = ["contents/2025-02-26/18h37m54s/test-0.png", "contents/2025-02-26/18h37m54s/test-1.png", "contents/2025-02-26/18h37m54s/test-2.png"];
    /*
    for (let i = 0; i < inputTextList.length; i++) {
      console.log(`[generating image...]\n${inputTextList[i]}\n`);
      const imagePath = await generateAnimationImage(basePath, i, inputTextList[i]);
      if (imagePath) imageListPath.push(imagePath);
    }
     */

    // 3. 비디오와 믹싱된 오디오 합성하기
    const outputVideoPath = path.join(CWD, "outputs", `${DateUtil.getTodayKSTString()}_${DateUtil.getCurrentKSTTime()}.mp4`);
    await FFMpeg.run(imageListPath, mixedAudioPath, outputVideoPath);

    return res.status(200).end();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal Server Error'); // 오류가 발생하면 500 응답 전송
  }
})

app.listen(8000, () => {
  console.log("App listening on port 8000");
});