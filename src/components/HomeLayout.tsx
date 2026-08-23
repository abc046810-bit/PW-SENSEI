import { Outlet, Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export default function HomeLayout() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#0a0a0c] text-gray-100">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 glass-card border-b-0 border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
              <GraduationCap size={24} />
            </div>
            <span className="font-bold text-xl tracking-wide text-white">PW SENSEI</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link 
              to="/auth" 
              className="text-gray-300 hover:text-white font-medium transition-colors hidden sm:block"
            >
              Courses / Batches
            </Link>
            <Link 
              to="/auth" 
              className="glow-button px-6 py-2.5 text-sm"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/50 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <GraduationCap size={24} className="text-purple-500" />
            <span className="font-bold text-lg text-white">PW SENSEI</span>
          </div>
          <p className="text-gray-400 text-sm text-center md:text-left">
            The top platform for accessible learning. &copy; {new Date().getFullYear()} PW SENSEI.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
