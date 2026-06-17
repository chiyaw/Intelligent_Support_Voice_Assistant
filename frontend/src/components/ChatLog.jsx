import React from "react";

function ChatLog({ history }) {
  return (
    <div className="w-full h-full p-4 flex flex-col overflow-hidden">
      
      <div className="pb-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <h2 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase flex items-center">
          <span className="mr-1.5 text-sm">💬</span> Support Chat Log Feed
        </h2>
        <span className="text-[10px] bg-slate-200 font-bold px-2 py-0.5 rounded-full text-slate-600">
          {history.length} Logs
        </span>
      </div>
      {history.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-400 italic text-center px-4">
            No active conversation messages recorded yet.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 flex flex-col">
          {[...history].reverse().map((item, index) => (
            <div key={index} className="flex flex-col space-y-1.5">
              
              <div className="w-full flex justify-end pl-6">
                <div className="bg-[#B12A5B] text-white rounded-2xl rounded-tr-none px-3.5 py-2 shadow-sm max-w-[95%]">
                  <p className="text-xs font-medium leading-relaxed">{item.question}</p>
                  <div className="text-[9px] text-white mt-1 text-right font-semibold tracking-wider uppercase">
                    You • {item.device !== "Unknown" ? item.device : "General"}
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-start pr-6">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-3.5 py-2 shadow-sm max-w-[95%]">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{item.answer}</p>
                  <div className="text-[9px] text-slate-400 mt-1 font-semibold tracking-wider uppercase">
                    🤖 Bot Response
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChatLog;