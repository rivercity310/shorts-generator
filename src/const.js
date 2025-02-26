const GOOGLE_API = Object.freeze({
  KEY: process.env.GOOGLE_API_KEY,
  ENDPOINT: process.env.GOOGLE_API_ENDPOINT
})

const OPENAI_API = Object.freeze({
  KEY: process.env.OPENAI_API_KEY,
})

module.exports = {
  GOOGLE_API,
  OPENAI_API
}