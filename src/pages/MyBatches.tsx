import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function MyBatches() {
  const [toast, setToast] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const ENROLLED = [
    { id: 101, title: "Vidyapeeth 51-YN481NA 2026", tag: "New", target: "For JEE 2026", lang: "Hinglish", dates: "Starts on 15 Apr 2024" },
    { id: 102, title: "Lakshya NEET Hindi 2027", tag: null, target: "For NEET 2027", lang: "Hindi", dates: "Starts on 01 May 2024" },
    { id: 103, title: "Class 12 Boards Masterclass", tag: null, target: "For CBSE 2025", lang: "English", dates: "Started on 01 Mar 2024" }
  ];

  return (
    <div className="max-w-[1200px] mx-auto w-full relative pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-green-50 border-l-4 border-[#22C55E] text-green-800 px-5 py-3.5 rounded-r shadow-xl flex items-center gap-3 transition-opacity duration-300 animate-in slide-in-from-right-10">
          <Check size={20} className="text-[#22C55E]" />
          <span className="font-semibold text-[15px]">You've successfully enrolled in 'Vidyapeeth 51-YN481NA 2026'.</span>
          <button onClick={() => setToast(false)} className="ml-4 text-green-700/60 hover:text-green-800 transition-colors"><X size={18} /></button>
        </div>
      )}

      <h1 className="text-[32px] font-bold text-gray-900 mb-8 tracking-tight">My Batches</h1>
      
      {/* Enrolled Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ENROLLED.map((batch) => (
          <div key={batch.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-gray-300 transition-all flex flex-col group">
            {/* Thumbnail */}
            <Link to={`/batch/${batch.id}`} className="block h-44 bg-gray-900 relative p-5 flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-800/80 to-indigo-900/80 mix-blend-multiply group-hover:scale-105 transition-transform duration-700"></div>
              <div className="relative z-10 flex justify-end">
                {batch.tag && <span className="bg-yellow-400 text-yellow-900 text-[11px] font-black px-2.5 py-1 rounded-sm uppercase tracking-wider shadow-sm">{batch.tag}</span>}
              </div>
              <div className="relative z-10">
                <h3 className="text-white font-bold text-[22px] drop-shadow-md line-clamp-2 leading-tight">{batch.title}</h3>
              </div>
            </Link>
            
            {/* Content */}
            <div className="p-5 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-pink-50 text-pink-700 border border-pink-200 text-xs font-bold px-2.5 py-1 rounded">{batch.lang}</span>
                <span className="text-xs text-gray-600 font-semibold px-2.5 py-1 bg-gray-100 border border-gray-200 rounded">{batch.target}</span>
              </div>
              
              <div className="text-[13px] text-gray-500 font-semibold flex items-center gap-2 mb-6 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                {batch.dates}
              </div>
              
              <div className="mt-auto">
                <div className="flex gap-3">
                  <Link to={`/batch/${batch.id}`} className="flex-1 flex justify-center py-3 border border-gray-900 bg-gray-900 hover:bg-gray-800 text-white text-center rounded-xl font-bold text-[15px] transition-colors shadow-sm">Study</Link>
                  <button className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[15px] transition-colors shadow-sm shadow-red-500/20">Unenroll</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
