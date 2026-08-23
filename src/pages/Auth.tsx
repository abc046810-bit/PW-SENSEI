import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/study");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-8 pb-0 flex flex-col items-center">
          <Link to="/" className="flex items-center gap-3 mb-8 hover:opacity-90 transition-opacity">
            <div className="w-12 h-12 bg-[#22C55E] text-white rounded-full flex items-center justify-center font-bold shadow-md shadow-green-500/20">
              <GraduationCap size={28} />
            </div>
            <span className="font-bold text-2xl tracking-tight">PW SENSEI</span>
          </Link>
          
          <div className="flex w-full border-b border-gray-200">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 pb-4 text-[15px] font-bold transition-all border-b-[3px] ${isLogin ? 'border-[#22C55E] text-[#22C55E]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 pb-4 text-[15px] font-bold transition-all border-b-[3px] ${!isLogin ? 'border-[#22C55E] text-[#22C55E]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Forms */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <input 
                  type="text" 
                  placeholder="Name" 
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all text-[15px]"
                />
              </div>
            )}
            
            <div className="space-y-1">
              <input 
                type="email" 
                placeholder="Email" 
                required
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all text-[15px]"
              />
            </div>
            
            <div className="space-y-1 relative">
              <input 
                type="password" 
                placeholder="Password" 
                required
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all text-[15px]"
              />
              {isLogin && (
                <div className="text-right mt-2">
                  <a href="#" className="text-sm text-gray-500 hover:text-[#22C55E] font-medium transition-colors">Forgot Password?</a>
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-1">
                <input 
                  type="password" 
                  placeholder="Confirm Password" 
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all text-[15px]"
                />
              </div>
            )}

            <button type="submit" className="w-full py-3.5 bg-[#22C55E] hover:bg-green-600 text-white rounded-xl font-bold text-[15px] transition-colors mt-4 shadow-sm shadow-green-500/10">
              {isLogin ? "Login" : "Register"}
            </button>
          </form>

          {isLogin && (
            <>
              <div className="relative my-7 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative bg-white px-4 text-sm text-gray-400 font-semibold tracking-wider">OR</div>
              </div>

              <button type="button" className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-3 shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-8">
            By continuing, you agree to our <a href="#" className="text-gray-900 font-medium hover:underline">Terms</a> & <a href="#" className="text-gray-900 font-medium hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
