import { motion } from 'motion/react';
import { Search, Mic, Filter, ExternalLink, School, Tractor as Agriculture, Baby, HeartPulse, Map, Bookmark, MessageSquare, User, Home, Zap } from 'lucide-react';
import { Scheme } from '../types';

const MOCK_SCHEMES: Scheme[] = [
  {
    id: '1',
    title: 'PM-Kisan Samman Nidhi Yojana',
    benefit: '₹6,000 / year',
    eligibility: 'Small and marginal farmers with landholdings up to 2 hectares.',
    deadline: 'Open year-round',
    category: 'Farmer',
    status: 'Active'
  },
  {
    id: '2',
    title: 'Post-Matric Scholarship Scheme',
    benefit: 'Full Tuition Fee',
    eligibility: 'SC/ST students with family income less than ₹2.5 Lakh per annum.',
    deadline: 'Ends in 12 days (31st Oct)',
    category: 'Student'
  },
  {
    id: '3',
    title: 'Lakhpati Didi Initiative',
    benefit: 'Skill & Finance Support',
    eligibility: 'Women members of Self Help Groups (SHGs).',
    deadline: 'Ongoing Recruitment',
    category: 'Women'
  }
];

export default function SchemeExplorer() {
  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-primary/10 shadow-sm">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Home className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-primary">Prahar AI</h1>
            </div>
            <button className="flex items-center justify-center rounded-full w-10 h-10 bg-primary/10 text-primary">
              <User className="size-6" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center bg-primary/5 rounded-xl border border-primary/10">
            <Search className="absolute left-4 text-primary/60 size-5" />
            <input 
              className="w-full bg-transparent border-none focus:ring-0 py-3 pl-12 pr-12 text-base placeholder:text-primary/40" 
              placeholder="Search schemes (e.g., PM Kisan)..." 
              type="text"
            />
            <button className="absolute right-4 text-primary">
              <Mic className="size-5" />
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-white px-4 text-sm font-semibold">
              <Filter className="size-4" />
              All Schemes
            </button>
            {[
              { icon: Agriculture, label: 'Farmer' },
              { icon: School, label: 'Student' },
              { icon: Baby, label: 'Women' },
              { icon: HeartPulse, label: 'Health' },
              { icon: Map, label: 'State' }
            ].map((cat, i) => (
              <button key={i} className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary/10 text-primary px-4 text-sm font-medium hover:bg-primary/20 transition-colors">
                <cat.icon className="size-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary">Recommended for you</h2>
          <span className="text-sm font-medium text-primary/60">24 Schemes found</span>
        </div>

        <div className="space-y-4 pb-24">
          {MOCK_SCHEMES.map((scheme) => (
            <motion.div 
              key={scheme.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-primary/5 flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold leading-snug flex-1">{scheme.title}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  scheme.category === 'Student' ? 'bg-blue-100 text-blue-700' : 
                  scheme.category === 'Women' ? 'bg-pink-100 text-pink-700' : 
                  'bg-green-100 text-green-700'
                }`}>
                  {scheme.status || scheme.category}
                </span>
              </div>

              <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between border-l-4 border-primary">
                <span className="text-sm font-medium text-primary/70">Benefit Amount</span>
                <span className="text-lg font-bold text-primary">{scheme.benefit}</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="text-primary/60 size-5 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Eligibility</p>
                    <p className="text-sm text-slate-700">{scheme.eligibility}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Filter className="text-primary/60 size-5 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Deadline</p>
                    <p className={`text-sm font-semibold ${scheme.deadline.includes('Ends') ? 'text-red-500' : 'text-slate-700'}`}>
                      {scheme.deadline}
                    </p>
                  </div>
                </div>
              </div>

              <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                Apply Now
                <ExternalLink className="size-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Floating Action Button */}
      <button className="fixed right-6 bottom-24 bg-primary text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 border-4 border-white">
        <Zap className="size-8" />
      </button>
    </div>
  );
}
