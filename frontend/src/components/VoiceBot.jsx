import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/constants";

const SILENCE_THRESHOLD = 12; 
const SILENCE_DURATION = 2500;  

function VoiceBot({ onNewInteraction, loading, setLoading }) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("Click 'Start Listening' to speak...");
  const [transcript, setTranscript] = useState("");
  const [device, setDevice] = useState("");
  const [answer, setAnswer] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const hasSpokenRef = useRef(false);

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  const speakResultOutLoud = (textToSpeak) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const containsHindi = /[\u0900-\u097F]/.test(textToSpeak) || 
                          /\b(nahi|kaam|kharab|paani|chalu|thanda|chal|ho|raha|hai)\b/i.test(textToSpeak);
    utterance.lang = containsHindi ? "hi-IN" : "en-IN"; 
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = async () => {
    if (isListening) stopRecordingAndProcess();
    else await startListeningSession();
  };

  const startListeningSession = async () => {
    window.speechSynthesis.cancel();
    audioChunksRef.current = [];
    hasSpokenRef.current = false;
    setTranscript(""); setDevice(""); setAnswer(""); setLoading(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; source.connect(analyser);
      audioContextRef.current = audioContext; analyserRef.current = analyser;

      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options = MediaRecorder.isTypeSupported("audio/ogg") ? { mimeType: "audio/ogg" } : {};
      }
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        if (!hasSpokenRef.current) {
          setStatus("No speech detected. Click Start Voice when you're ready.");
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || "audio/webm" });
        await sendAudioToBackend(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsListening(true);
      setStatus("🗣️ Listening... Speak your problem now");
      trackAudioSilence();
    } catch (err) {
      console.error(err);
      setStatus("Microphone access failed.");
    }
  };

  const trackAudioSilence = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const monitorLoop = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const averageVolume = sum / dataArray.length;

      if (averageVolume > SILENCE_THRESHOLD) {
        hasSpokenRef.current = true;
        setStatus("🗣️ Listening... Speak your problem now");
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      } else {
        if (!silenceTimerRef.current) {
          setStatus("⏳ Waiting for you to finish speaking...");
          silenceTimerRef.current = setTimeout(() => { stopRecordingAndProcess(); }, SILENCE_DURATION);
        }
      }
      animationFrameRef.current = requestAnimationFrame(monitorLoop);
    };
    monitorLoop();
  };

  const stopRecordingAndProcess = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
    cleanupAudio(); setIsListening(false);
  };

  const sendAudioToBackend = async (audioBlob) => {
    setLoading(true); setStatus("🤖 AI agent evaluating...");
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    try {
      const res = await axios.post(`${API_BASE_URL}/search`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      const { transcript: text, device: dev, answer: ans } = res.data;
      const trimmedText = text?.trim();

      if (!trimmedText) {
        setStatus("No speech detected. Click Start Voice when you're ready.");
        return;
      }

      setTranscript(trimmedText); setDevice(dev || "Unknown"); setAnswer(ans);
      onNewInteraction({ question: trimmedText, device: dev, answer: ans });
      if (ans) speakResultOutLoud(ans);
    } catch (err) {
      console.error(err);
      setAnswer("Could not fetch backend response.");
    } finally {
      setLoading(false);
      setStatus((prev) =>
        prev === "No speech detected. Click Start Voice when you're ready."
          ? prev
          : "Click 'Start Listening' to speak..."
      );
    }
  };

  const cleanupAudio = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
  };

  return (
    <div className="w-full flex flex-col p-6 space-y-6">
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-100 rounded-xl">
        <button
          onClick={toggleListening}
          disabled={loading}
          className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-md ${
            isListening ? "bg-emerald-500 text-white animate-pulse ring-8 ring-emerald-100" : "bg-[#FF867A] text-white hover:bg-[#B12A5B] ring-8 ring-[#ebccc9]"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="text-3xl mb-1">{isListening ? "🔊" : "🎤"}</span>
          <span className="text-[11px] font-bold tracking-wider uppercase">{isListening ? "Listening" : "Start Voice"}</span>
        </button>
        <p className="text-xs font-semibold text-slate-600 mt-4">
          Status: <span className={isListening ? "text-emerald-600 font-bold" : "text-[#B12A5B]"}>{status}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Captured Query</h3>
          <p className="text-sm text-slate-800 font-medium italic">{transcript ? `"${transcript}"` : "Awaiting microphone..."}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Device Category</h3>
          <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#ebccc9] text-[#B12A5B]">{device || "None"}</span>
        </div>
      </div>

      <div className="bg-[#ebccc9] border border-indigo-100 p-4 rounded-xl">
        <h3 className="text-[11px] font-bold text-[#B12A5B] uppercase tracking-wider mb-1">Live Solution Remedy</h3>
        <p className="text-sm text-slate-700 font-medium leading-relaxed">{answer || "Speak down your hardware problem."}</p>
      </div>
    </div>
  );
}

export default VoiceBot;