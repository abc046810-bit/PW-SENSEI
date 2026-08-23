import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, MonitorPlay, GraduationCap, Send, Heart, FileText, Phone, ChevronLeft, Moon, Star } from "lucide-react";

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: "Study", path: "/overview", icon: <BookOpen size={20} /> },
    { name: "Batches", path: "/study", icon: <MonitorPlay size={20} /> },
    { name: "My Batches", path: "/my-batches", icon: <GraduationCap size={20} /> },
    { name: "Join Telegram", path: "#", icon: <Send size={20} /> },
    { name: "Donate Batch", path: "#", icon: <Heart size={20} /> },
    { name: "Test Series", path: "#", icon: <FileText size={20} /> },
    { name: "Contact Us", path: "#", icon: <Phone size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-[260px] bg-white border-r border-gray-200 hidden md:flex flex-col z-20 shadow-sm">
        <Link to="/" className="h-16 flex items-center px-5 border-b border-gray-100 gap-3 hover:bg-gray-50 transition-colors">
          <div className="w-9 h-9 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
            <GraduationCap size={20} />
          </div>
          <span className="font-bold text-[17px] tracking-tight text-gray-900">PW SENSEI</span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-5 px-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.name === 'Batches' && location.pathname.startsWith('/batch/'));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium transition-colors ${
                  isActive ? "bg-[#1F2937] text-white shadow-md" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.icon}
                <span className="text-[15px]">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-colors">
            <ChevronLeft size={20} />
            <span className="hidden sm:inline">Back</span>
          </button>
          
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-bold border border-gray-200 text-gray-700 shadow-sm">
              <Star size={16} className="text-yellow-500 fill-yellow-500" />
              <span>0 XP</span>
            </div>
            <button className="text-gray-400 hover:text-gray-700 transition-colors">
              <Moon size={22} />
            </button>
            <div className="flex items-center gap-3 border-l border-gray-200 pl-4 sm:pl-6">
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">Hi, SK</span>
              <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white cursor-pointer hover:bg-green-600 transition-colors">
                SK
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
