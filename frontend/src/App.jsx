import React, { useState } from "react";
import VoiceBot from "./components/VoiceBot";
import ChatLog from "./components/ChatLog";

function App() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleNewInteraction = (newLogEntry) => {
    setHistory((prev) => [newLogEntry, ...prev]);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      <header className="shrink-0 border-b border-[#B12A5B] bg-[#B12A5B] px-6 py-4 text-center text-white">
        <h1 className="text-xl font-extrabold tracking-tight">
          🔧 Intelligent Support Voice Assistant
        </h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="h-full w-2/3 overflow-y-auto border-r border-slate-200 bg-white">
          <VoiceBot
            onNewInteraction={handleNewInteraction}
            loading={loading}
            setLoading={setLoading}
          />
        </section>

        <section className="h-full w-1/3 overflow-hidden bg-slate-50">
          <ChatLog history={history} />
        </section>
      </div>
    </div>
  );
}

export default App;
