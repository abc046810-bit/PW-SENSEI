import { Share2, Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function BatchDetail() {
  return (
    <div className="max-w-[1200px] mx-auto w-full pb-16">
      {/* Hero Banner */}
      <div className="w-full rounded-3xl bg-gradient-to-r from-[#6C3EF4] to-indigo-600 p-8 sm:p-12 mb-8 relative overflow-hidden shadow-sm">
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none">
          <div className="absolute right-10 top-10 w-32 h-32 border-[6px] border-white/50 rounded-2xl rotate-12"></div>
          <div className="absolute right-48 bottom-[-30px] w-40 h-40 border-[6px] border-white/50 rounded-full"></div>
          <div className="absolute right-72 top-20 w-20 h-20 border-[6px] border-white/50 rounded-xl -rotate-12"></div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight tracking-tight">Lakshya NEET Hindi 2027</h1>
          <div className="flex gap-3 mb-6">
            <span className="px-3.5 py-1.5 bg-white/20 text-white rounded-lg font-bold text-[13px] border border-white/30 backdrop-blur-sm shadow-sm">Hinglish</span>
            <span className="px-3.5 py-1.5 bg-white/20 text-white rounded-lg font-bold text-[13px] border border-white/30 backdrop-blur-sm shadow-sm">For NEET 2027</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8 flex overflow-x-auto scrollbar-hide">
        <button className="px-6 py-4 text-gray-500 font-semibold hover:text-gray-900 whitespace-nowrap flex items-center gap-2 transition-colors">
          📘 Description
        </button>
        <button className="px-6 py-4 text-[#7C3AED] font-bold border-b-[3px] border-[#7C3AED] whitespace-nowrap flex items-center gap-2">
          🎁 All Classes
        </button>
        <button className="px-6 py-4 text-gray-500 font-semibold hover:text-gray-900 whitespace-nowrap flex items-center gap-2 transition-colors">
          📝 Tests
        </button>
        <button className="px-6 py-4 text-gray-500 font-semibold hover:text-gray-900 whitespace-nowrap flex items-center gap-2 transition-colors">
          ♾️ Infinity Learning
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-12">
        <button className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold flex items-center gap-2 text-[15px] transition-colors shadow-sm bg-white">
          <Share2 size={18} /> Share Batch
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold flex items-center gap-2 text-[15px] transition-colors shadow-sm bg-white">
          <Bell size={18} /> Announcement
        </button>
      </div>

      {/* Today's Class */}
      <div className="mb-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Today's Class</h2>
        <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide snap-x">
          {[
            { id: 1, name: "Vishnu Nagar Sir", time: "04:00 PM", subject: "प्रत्यावर्ती धारा 01 : || (DPP Will Be P..." },
            { id: 2, name: "Amit Mahajan Sir", time: "06:30 PM", subject: "Equilibrium 03 : Law Of Chemical..." }
          ].map((item) => (
            <div key={item.id} className="min-w-[300px] sm:min-w-[340px] bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm snap-start shrink-0 hover:shadow-md transition-shadow">
              <div className="h-44 bg-gray-200 relative">
                {/* Teacher placeholder image */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent flex items-end p-4">
                  <span className="text-white font-bold text-[15px] drop-shadow-md">{item.name}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-[#7C3AED] text-white text-[11px] font-black rounded-md uppercase tracking-widest shadow-sm">Upcoming</span>
                  <span className="text-[13px] text-gray-500 font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 block"></span> {item.time}</span>
                </div>
                <p className="font-bold text-gray-900 text-[15px] line-clamp-2 leading-snug">{item.subject}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subjects */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Subjects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { icon: "📢", title: "Notices", count: "10 Chapters" },
            { icon: "🔬", title: "Physics", count: "14 Chapters" },
            { icon: "🌿", title: "Botany", count: "10 Chapters" },
            { icon: "🐟", title: "Zoology", count: "11 Chapters" },
            { icon: "⚛️", title: "Physical Chemistry", count: "13 Chapters" },
            { icon: "🧪", title: "Organic Chemistry", count: "11 Chapters" },
            { icon: "🧲", title: "Inorganic Chemistry", count: "2 Chapters" }
          ].map((sub, idx) => (
            <Link to="#" key={idx} className="flex items-center gap-5 p-5 border border-gray-200 rounded-2xl bg-white hover:border-[#7C3AED]/30 hover:shadow-md transition-all group">
              <div className="w-14 h-14 bg-slate-50 text-2xl flex items-center justify-center rounded-xl border border-slate-200 group-hover:bg-[#7C3AED]/10 group-hover:border-[#7C3AED]/20 transition-colors shadow-sm">
                {sub.icon}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-[17px] mb-0.5 group-hover:text-[#7C3AED] transition-colors">{sub.title}</h3>
                <p className="text-[14px] text-gray-500 font-medium">{sub.count}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
