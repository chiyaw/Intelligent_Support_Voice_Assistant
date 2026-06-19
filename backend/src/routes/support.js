const express = require("express");
const router = express.Router();
const multer = require("multer");
const { Groq } = require("groq-sdk");
const kb = require("../data/kb.json");
const constants = require("../config/constants");


const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});

const groq = new Groq({
  apiKey: constants.GROQ_API_KEY,
});

function containsHindi(text) {
  return (
    /[\u0900-\u097F]/.test(text) ||
    /\b(nahi|kaam|kharab|paani|chalu|thanda|chal|ho|raha|hai|vibration|awaj)\b/i.test(
      text
    )
  );
}

function normalizeTextToTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function calculateKeywordScore(
  normalizedQuery,
  queryTokenSet,
  keyword
) {
  const normalizedKeyword = keyword.toLowerCase().trim();

  if (!normalizedKeyword) return 0;

  let score = 0;

  if (normalizedQuery.includes(normalizedKeyword)) {
    score += constants.EXACT_PHRASE_WEIGHT;
  }

  const keywordTokens = normalizeTextToTokens(
    normalizedKeyword
  ).filter((token) => token.length > 2);

  const uniqueKeywordTokens = [...new Set(keywordTokens)];

  uniqueKeywordTokens.forEach((token) => {
    if (queryTokenSet.has(token)) {
      score += constants.PARTIAL_WORD_WEIGHT;
    }
  });

  return score;
}

router.post(
  "/search",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No audio file uploaded",
        });
      }

      console.log("📁 Audio uploaded, size:", req.file.size);

      const prompt =
        "AC thanda nahi kar raha hai. Washing machine chalu nahi ho rahi hai. Refrigerator cooling issue. Fridge vibration noise. Paani tapak raha hai. Fan nahi chal raha.";

      let hindiTranscription;
      let englishTranscription;

      try {
        console.log("🎤 Starting transcription");

       
        const { Readable } = require('stream');
        const audioStream = Readable.from([req.file.buffer]);
        
        [hindiTranscription, englishTranscription] =
          await Promise.all([
            groq.audio.transcriptions.create({
              file: audioStream,
              model: constants.WHISPER_MODEL,
              prompt,
              language: "hi",
            }),
            groq.audio.transcriptions.create({
              file: audioStream,
              model: constants.WHISPER_MODEL,
              prompt,
              language: "en",
            }),
          ]);

        console.log("✅ Transcription complete");
      } catch (err) {
        console.error("❌ Groq Transcription Failed");
        console.error(err);
        throw new Error(`Groq transcription failed: ${err.message}`);
      }

      let hindiText = "";
      let englishText = "";

      try {
        hindiText = (hindiTranscription?.text || "").trim();
        englishText = (englishTranscription?.text || "").trim();
        console.log("Hindi :", hindiText);
        console.log("English :", englishText);
      } catch (err) {
        console.error("❌ Transcript Extraction Error");
        throw err;
      }

      let query = "";

      try {
        if (hindiText && !englishText) {
          query = hindiText;
        } else if (!hindiText && englishText) {
          query = englishText;
        } else if (hindiText && englishText) {
          query = containsHindi(hindiText) ? hindiText : englishText;
        }

        console.log("Selected Query :", query);
      } catch (err) {
        console.error("❌ Query Selection Error");
        throw err;
      }

      if (!query || !query.trim()) {
        return res.json({
          transcript: "",
          device: "Unknown",
          answer: "",
          audioUrl: null,
        });
      }

      let answer = constants.FALLBACK_RESPONSE;
      let device = "Not identified";

      try {
        const normalizedQuery = query.toLowerCase().trim();
        const queryTokenSet = new Set(
          normalizeTextToTokens(normalizedQuery)
        );

        let bestSpecificMatch = null;
        let highestSpecificScore = 0;
        let bestGenericMatch = null;
        let highestGenericScore = 0;

        kb.forEach((item) => {
          const score = item.keywords.reduce(
            (acc, keyword) => {
              return (
                acc +
                calculateKeywordScore(
                  normalizedQuery,
                  queryTokenSet,
                  keyword
                )
              );
            },
            0
          );

          const isGeneric = item.device.toLowerCase() === "any device";

          if (isGeneric) {
            if (score > highestGenericScore) {
              highestGenericScore = score;
              bestGenericMatch = item;
            }
          } else {
            if (score > highestSpecificScore) {
              highestSpecificScore = score;
              bestSpecificMatch = item;
            }
          }
        });

        if (
          bestSpecificMatch &&
          highestSpecificScore >= constants.MIN_MATCH_SCORE
        ) {
          answer = bestSpecificMatch.answer;
          device = bestSpecificMatch.device;
        } else if (
          bestGenericMatch &&
          highestGenericScore >= constants.MIN_MATCH_SCORE
        ) {
          answer = bestGenericMatch.answer;
          device = bestGenericMatch.device;
        }

        console.log("Device :", device);
        console.log("Answer :", answer);
      } catch (err) {
        console.error("❌ KB Search Error");
        console.error(err);
        throw err;
      }

      let audioUrl = null;

      try {
        const ttsLang = containsHindi(query) ? "hi" : "en";
        const encodedText = encodeURIComponent(answer);
        audioUrl =
          `https://translate.google.com/translate_tts` +
          `?ie=UTF-8` +
          `&tl=${ttsLang}` +
          `&client=tw-ob` +
          `&q=${encodedText}`;
      } catch (err) {
        console.error("❌ TTS Error");
        console.error(err);
        audioUrl = null;
      }

      return res.json({
        transcript: query,
        device,
        answer,
        audioUrl,
      });
    } catch (error) {
      console.error("\n========== ERROR ==========");
      console.error("Name :", error.name);
      console.error("Message :", error.message);
      console.error("Stack :", error.stack);
      console.error("===========================\n");

      return res.status(500).json({
        success: false,
        error: error.message,
        type: error.name,
      });
    }
  }
);

module.exports = router;