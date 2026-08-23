import { ArrowRight, PlayCircle, BookOpen, Star, Trophy, Users, CheckCircle2, Download } from "react-router-dom"; // Wait, importing lucide icons properly below
import { Link } from "react-router-dom";
import { BookOpen as BookIcon, Star as StarIcon, Trophy as TrophyIcon, Users as UsersIcon, CheckCircle2 as CheckIcon, Download as DownloadIcon, PlayCircle as PlayIcon, ArrowRight as ArrowIcon } from "lucide-react";
import { motion } from "motion/react";

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col justify-center items-center overflow-hidden px-6 pt-20 pb-32">
        {/* Background Gradients */}
        <div className="absolute inset-0 z-0 bg-[#0a0a0c]">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/30 blur-[120px] bg-animated-glow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/30 blur-[120px] bg-animated-glow" style={{ animationDelay: "4s" }} />
          <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-indigo-900/20 blur-[150px]" />
        </div>
        
        {/* Particle/Grid overlay (subtle) */}
        <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYzLTVoMnYtM2gtMnYtM2gtMnYzaC0ydjN2MmgzdjNoMnYtM2gtMnoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyIvPjwvZz48L3N2Zz4=')] opacity-50"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-purple-300 text-sm font-medium mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
            New Batches Starting Soon
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 mb-6 leading-tight"
          >
            We Make Education <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Affordable.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed"
          >
            Access premium educational content, structured live batches, and comprehensive study materials from India's top educators.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-5"
          >
            <Link to="/study" className="glow-button px-8 py-4 text-lg flex items-center justify-center gap-2">
              Start Learning Now <ArrowIcon size={20} />
            </Link>
            <Link to="#how-it-works" className="px-8 py-4 text-lg font-medium text-white rounded-full glass-card hover:bg-white/10 transition-all flex items-center justify-center gap-2">
              <PlayIcon size={20} className="text-blue-400" /> Watch Demo
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose PW SENSEI?</h2>
            <p className="text-gray-400">Everything you need to excel in your studies.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6 border border-blue-500/20">
                <TrophyIcon size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Top Educators</h3>
              <p className="text-gray-400 leading-relaxed">Learn directly from the best minds in India. Our faculty brings years of experience and proven track records.</p>
            </div>
            
            <div className="glass-card p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px]" />
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6 border border-purple-500/20 relative z-10">
                <BookIcon size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white relative z-10">Free Access</h3>
              <p className="text-gray-400 leading-relaxed relative z-10">Get started with a massive library of free content. Quality education shouldn't be a privilege.</p>
            </div>
            
            <div className="glass-card p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/20">
                <UsersIcon size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Study Anywhere</h3>
              <p className="text-gray-400 leading-relaxed">Seamlessly switch between web and mobile. Download lectures and study materials for offline access.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-white/[0.02] border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Journey to Success</h2>
            <p className="text-gray-400">Three simple steps to start learning.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent -translate-y-1/2 z-0" />
            
            {[
              { step: 1, title: "Sign Up", desc: "Create your free account in seconds.", icon: <CheckIcon size={24} /> },
              { step: 2, title: "Browse Batches", desc: "Find the perfect course for your goals.", icon: <BookIcon size={24} /> },
              { step: 3, title: "Start Learning", desc: "Attend live classes and access materials.", icon: <PlayIcon size={24} /> },
            ].map((item, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-black border-2 border-purple-500/50 flex items-center justify-center text-purple-400 mb-6 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">Step {item.step}: {item.title}</h3>
                <p className="text-gray-400 max-w-[250px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Student Success Stories</h2>
            <p className="text-gray-400">Join thousands of students achieving their dreams.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "Rahul Sharma", role: "JEE Aspirant", text: "PW SENSEI completely changed how I study. The live classes are incredibly interactive and the notes are top-notch.", rating: 5 },
              { name: "Priya Patel", role: "NEET Aspirant", text: "Affordable and brilliant. I cleared all my doubts using their platform. The educators are literally the best.", rating: 5 },
              { name: "Amit Kumar", role: "Class 12 Board", text: "The structured batches kept me disciplined throughout the year. The mock tests were very close to the real exams.", rating: 4 },
            ].map((t, idx) => (
              <div key={idx} className="glass-card p-8 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 mb-4 text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon key={i} size={16} fill={i < t.rating ? "currentColor" : "none"} className={i >= t.rating ? "text-gray-600" : ""} />
                    ))}
                  </div>
                  <p className="text-gray-300 italic mb-6">"{t.text}"</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{t.name}</h4>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Download Section */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-[2.5rem] p-8 md:p-16 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12 border-blue-500/20">
            <div className="absolute top-0 right-0 w-[80%] h-[100%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="flex-1 relative z-10 text-center md:text-left">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
                Download The <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Official App</span>
              </h2>
              <p className="text-gray-400 mb-8 text-lg max-w-md mx-auto md:mx-0">
                Take your studies anywhere. Stream video lectures, attend live classes, and download study materials straight to your device.
              </p>
              
              <button className="glow-button px-8 py-4 text-lg inline-flex items-center gap-3">
                <DownloadIcon size={24} />
                Download Android App (APK)
              </button>
            </div>
            
            <div className="relative z-10 flex-shrink-0 w-64 h-[500px] bg-black rounded-[2.5rem] border-[8px] border-gray-800 shadow-2xl overflow-hidden hidden md:block transform rotate-3">
              {/* Mock App Screen */}
              <div className="w-full h-full bg-[#0a0a0c] flex flex-col pt-8 px-4">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-purple-500" />
                  <div className="h-4 w-24 bg-white/20 rounded" />
                </div>
                <div className="h-32 w-full bg-blue-500/20 rounded-xl mb-4" />
                <div className="h-8 w-3/4 bg-white/10 rounded mb-6" />
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="h-24 bg-white/5 rounded-xl" />
                  <div className="h-24 bg-white/5 rounded-xl" />
                </div>
                <div className="h-12 w-full bg-purple-600 rounded-full mt-auto mb-4" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
