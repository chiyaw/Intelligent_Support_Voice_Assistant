require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL,
  WHISPER_MODEL: "whisper-large-v3",
  MIN_MATCH_SCORE: 2,
  EXACT_PHRASE_WEIGHT: 10,
  PARTIAL_WORD_WEIGHT: 1,
  FALLBACK_RESPONSE: "Sorry, I couldn't find a troubleshooting guide for that issue. Please contact customer support.",
  EMPTY_QUERY_RESPONSE: "Please provide a valid voice query.",
  DEPLOYED_BE: "https://intelligent-support-voice-assistant-sigma.vercel.app/api/search"
};