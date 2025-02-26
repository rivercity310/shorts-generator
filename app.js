const express = require("express");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const GOOGLE_API_ENDPOINT = "https://texttospeech.googleapis.com";
const GOOGLE_API_KEY = "AIzaSyA3TmZcHhvY40g8eitQKPJQRyGTMT9VL5w";
const OPENAI_API_KEY = "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";

const app = express();
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
})

app.use(express.json({ limit: "50mb"}));  // JSON 본문 크기 제한 증가
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

async function generateVoiceSynthesisMP3File(basePath, text) {
  const url = path.join(GOOGLE_API_ENDPOINT, "/v1beta1/text:synthesize");

  const data = await fetch(url, {
    method: "POST",
    headers: {
      "X-goog-api-key": GOOGLE_API_KEY
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

async function generateImage(basePath, i, text) {
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

function getTodayKSTString() {
  const today = new Date(Date.now() + (9 * 60 * 60 * 1000));
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCurrentKSTTime() {
  const today = new Date(Date.now() + (9 * 60 * 60 * 1000));
  const hour = String(today.getHours()).padStart(2, '0');
  const minute = String(today.getMinutes()).padStart(2, '0');
  const second = String(today.getSeconds()).padStart(2, '0');

  return `${hour}h${minute}m${second}s`;
}

app.post("/", async (req, res) => {
  // 오늘자 폴더가 생성되어 있는지 확인
  const todayPath = path.join("contents", getTodayKSTString());
  if (!fs.existsSync(todayPath)) fs.mkdirSync(todayPath);

  // 요청당 "HH-MM-DD" 이름의 폴더가 생성됨
  // 해당 폴더 내부에는 voice.mp3, image-${i}.png 파일 및 최종 숏츠 영상이 저장됨.
  const basePath = path.join(todayPath, getCurrentKSTTime());
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath);

  const { inputText } = req.body;
  const result = await generateVoiceSynthesisMP3File(basePath, inputText);
  const images = await generateImage(basePath, 0, inputText);

  return res.status(result && images ? 200 : 500).end();
})

app.listen(8000, () => {
  console.log("App listening on port 8000");
});