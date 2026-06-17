const express = require("express");
const router = express.Router();
const multer = require("multer");
const { Groq } = require("groq-sdk");
const fs = require("fs");
const path = require("path");
const kb = require("../data/kb.json");
const constants = require("../config/constants");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.webm');
  }
});

const upload = multer({ storage: storage });
const groq = new Groq({ apiKey: constants.GROQ_API_KEY });

function containsHindi(text) {
  return /[\u0900-\u097F]/.test(text) || 
         /\b(nahi|kaam|kharab|paani|chalu|thanda|chal|ho|raha|hai|vibration|awaj)\b/i.test(text);
}

function normalizeTextToTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function calculateKeywordScore(normalizedQuery, queryTokenSet, keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (!normalizedKeyword) return 0;

  let score = 0;
  if (normalizedQuery.includes(normalizedKeyword)) {
    score += constants.EXACT_PHRASE_WEIGHT;
  }

  const keywordTokens = normalizeTextToTokens(normalizedKeyword).filter((token) => token.length > 2);
  const uniqueKeywordTokens = [...new Set(keywordTokens)];

  uniqueKeywordTokens.forEach((token) => {
    if (queryTokenSet.has(token)) {
      score += constants.PARTIAL_WORD_WEIGHT;
    }
  });

  return score;
}

router.post("/search", upload.single("audio"), async (req, res) => {
  let audioPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ answer: constants.EMPTY_QUERY_RESPONSE });
    }

    audioPath = req.file.path;

    const prompt =
      "Mera AC thanda nahi kar raha hai. Washing machine chalu nahi ho raha hai. Refrigerator or fridge is not cooling, vibrating noise issue, paani tapak raha hai, fan nahi chal raha.";

    // Strict language set: transcribe only in Hindi and English.
    const [hindiTranscription, englishTranscription] = await Promise.all([
      groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: constants.WHISPER_MODEL,
        prompt,
        language: "hi",
      }),
      groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: constants.WHISPER_MODEL,
        prompt,
        language: "en",
      }),
    ]);

    const hindiText = (hindiTranscription?.text || "").trim();
    const englishText = (englishTranscription?.text || "").trim();

    let query = "";
    if (hindiText && !englishText) query = hindiText;
    else if (!hindiText && englishText) query = englishText;
    else if (hindiText && englishText) {
      query = containsHindi(hindiText) ? hindiText : englishText;
    }

    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    if (!query || query.trim() === "") {
      return res.json({
        transcript: "",
        device: "Unknown",
        answer: "",
        audioUrl: null
      });
    }


    const normalizedQuery = query.toLowerCase().trim();
    const queryTokenSet = new Set(normalizeTextToTokens(normalizedQuery));

    let bestSpecificMatch = null;
    let highestSpecificScore = 0;
    let bestGenericMatch = null;
    let highestGenericScore = 0;

    kb.forEach((item) => {
      const score = item.keywords.reduce((acc, keyword) => {
        return acc + calculateKeywordScore(normalizedQuery, queryTokenSet, keyword);
      }, 0);

      const isGeneric = item.device.toLowerCase() === "any device";
      if (isGeneric) {
        if (score > highestGenericScore) {
          highestGenericScore = score;
          bestGenericMatch = item;
        }
      } else if (score > highestSpecificScore) {
        highestSpecificScore = score;
        bestSpecificMatch = item;
      }
    });

    let answer = constants.FALLBACK_RESPONSE;
    let device = "Not identified";

    if (bestSpecificMatch && highestSpecificScore >= constants.MIN_MATCH_SCORE) {
      answer = bestSpecificMatch.answer;
      device = bestSpecificMatch.device;
    } else if (bestGenericMatch && highestGenericScore >= constants.MIN_MATCH_SCORE) {
      answer = bestGenericMatch.answer;
      device = bestGenericMatch.device;
    }

    const ttsLang = containsHindi(query) ? "hi" : "en";
    const encodedText = encodeURIComponent(answer);
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodedText}`;

    return res.json({
      transcript: query,
      device: device,
      answer: answer,
      audioUrl: audioUrl
    });

  } catch (error) {
    console.error("Server Error:", error);
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    return res.status(500).json({ answer: "Internal voice extraction pipeline error." });
  }
});

module.exports = router;