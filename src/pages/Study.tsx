import { useState } from "react";
import { Search, Check, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function Study() {
  const [toast, setToast] = useState<string | null>(null);

  const BATCHES = [
    { id: 1, title: "Vidyapeeth 28-YN201EA", tag: "New", target: "For NEET 2024", lang: "Hinglish", dates: "Starts on 12 Apr 2024 | Ends on 30 Jan 2025" },
    { id: 2, title: "Lakshya JEE 2025 Regular", tag: "New", target: "For JEE 2025", lang: "Hinglish", dates: "Starts on 05 May 2024 | Ends on 15 Feb 2025" },
    { id: 3, title: "Arjuna NEET 1.0", tag: null, target: "For NEET 2026", lang: "Hinglish", dates: "Starts on 20 Jun 2024 | Ends on 10 Mar 2026" },
    { id: 4, title: "Prayas Dropper Batch", tag: null, target: "For JEE 2024", lang: "English", dates: "Starts on 10 Aug 2023 | Ends on 30 May 2024" },
    { id: 5, title: "Udaan State Police", tag: "Trending", target: "Police Exams", lang: "Hindi", dates: "Starts on 01 Sep 2024 | Ends on 01 Dec 2024" },
    { id: 6, title: "Yakeen NEET Crash Course", tag: null, target: "For NEET 2024", lang: "Hinglish", dates: "Starts on 01 Jan 2024 | Ends on 30 Apr 2024" }
  ];

  const handleEnroll = (e: React.MouseEvent) => {
    e.preventDefault();
    setToast("Successfully enrolled!");
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="max-w-[1200px] mx-auto w-full pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-green-50 border-l-4 border-[#22C55E] text-green-800 px-5 py-3.5 rounded-r shadow-xl flex items-center gap-3 animate-in slide-in-from-right-10 fade-in duration-300">
          <Check size={20} className="text-[#22C55E]" />
          <span className="font-semibold text-[15px]">{toast}</span>
          <button onClick={() => setToast(null)} className="ml-4 text-green-700/60 hover:text-green-800 transition-colors"><X size={18} /></button>
        </div>
      )}

      <h1 className="text-[32px] font-bold text-gray-900 mb-6 tracking-tight">Batches</h1>
      
      {/* Search Bar */}
      <div className="flex w-full mb-8 shadow-sm rounded-xl overflow-hidden border border-gray-200 bg-white">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={22} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search Your Batch" 
            className="w-full h-full pl-12 pr-4 py-3.5 focus:outline-none focus:ring-0 text-gray-700 text-[15px]"
          />
        </div>
        <button className="bg-[#22C55E] hover:bg-green-600 text-white font-bold px-10 py-3.5 transition-colors text-[15px]">
          Search
        </button>
      </div>

      {/* Promotional Banner */}
      <div className="border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 sm:p-8 mb-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-400/20 rounded-full blur-[80px] -z-0"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-400/20 rounded-full blur-[80px] -z-0"></div>
        
        <div className="relative z-10 flex-1 w-full text-center md:text-left">
          <span className="inline-block px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-black mb-4 border border-red-200 tracking-wider uppercase shadow-sm">EXAM DATES OUT</span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 tracking-tight">One Final Test, One Massive Opportunity!</h2>
          <p className="text-red-600 font-bold text-lg sm:text-xl mb-5">Get Up To 90% SCHOLARSHIP</p>
          <button className="px-7 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors shadow-md hover:-translate-y-0.5 duration-200">
            Register Now &rarr;
          </button>
        </div>
        <div className="relative z-10 w-full md:w-56 h-36 bg-white rounded-xl border border-red-100 shadow-md flex items-center justify-center p-6 text-center rotate-0 md:rotate-3 transform hover:rotate-0 transition-transform">
          <p className="font-black text-xl text-gray-800 leading-tight">National Scholarship Test</p>
        </div>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {BATCHES.map((batch) => (
          <Link to={`/batch/${batch.id}`} key={batch.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-gray-300 transition-all flex flex-col group block">
            {/* Thumbnail */}
            <div className="h-44 bg-gray-900 relative p-5 flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900/60 to-purple-900/60 mix-blend-multiply group-hover:scale-105 transition-transform duration-700"></div>
              <div className="relative z-10 flex justify-end">
                {batch.tag && <span className="bg-yellow-400 text-yellow-900 text-[11px] font-black px-2.5 py-1 rounded-sm uppercase tracking-wider shadow-sm">{batch.tag}</span>}
              </div>
              <div className="relative z-10">
                <h3 className="text-white font-bold text-[22px] drop-shadow-md line-clamp-2 leading-tight">{batch.title}</h3>
              </div>
            </div>
            
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
                <p className="text-[13px] text-gray-600 mb-4 font-semibold flex items-center"><span className="font-bold text-[#22C55E] text-xl mr-2">₹ FREE</span><span className="line-through text-gray-400 mr-2 font-medium">₹0</span> &middot; <span className="ml-2">100% Free For Students</span></p>
                <div className="flex gap-3">
                  <button className="flex-1 py-3 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] transition-all">Study</button>
                  <button onClick={handleEnroll} className="flex-1 py-3 bg-[#22C55E] hover:bg-green-600 text-white rounded-xl font-bold text-[15px] transition-all shadow-sm shadow-green-500/20">Enroll Now</button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
