import { motion } from 'motion/react';
import { 
  LayoutGrid as Hub, 
  Verified, 
  Bell, 
  UploadCloud, 
  Download, 
  BarChart3, 
  Image as ImageIcon, 
  Mic, 
  FileText, 
  Video, 
  Users, 
  ArrowRight, 
  LayoutGrid, 
  Construction, 
  Activity as Analytics, 
  UserCircle,
  Globe
} from 'lucide-react';

export default function PartnerPortal() {
  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white border-b border-primary/10 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-white">
              <Hub className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Partner Portal</h1>
              <div className="flex items-center gap-1">
                <span className="text-xs text-primary font-semibold flex items-center gap-0.5">
                  <Verified className="size-3" /> Verified NGO
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs text-slate-500">ID: 88291</span>
              </div>
            </div>
          </div>
          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
            <Bell className="size-6" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6 pb-24">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-primary/10">
              <img 
                src="https://picsum.photos/seed/ngo/200/200" 
                alt="NGO Logo" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Gram Panchayat Seva</h2>
              <p className="text-sm text-slate-500 mb-3">Service to community through AI</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 p-2 rounded-xl">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Lives Impacted</p>
                  <p className="text-lg font-bold text-primary">12,450</p>
                </div>
                <div className="bg-primary/5 p-2 rounded-xl">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Sync Status</p>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-sm font-bold text-primary">Live</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Onboarding */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-slate-800">Bulk Beneficiary Onboarding</h3>
            <button className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline">
              <Download className="size-3" /> Get Template
            </button>
          </div>
          <div className="bg-white border-2 border-dashed border-primary/20 rounded-2xl p-8 flex flex-col items-center text-center">
            <div className="h-14 w-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="size-8" />
            </div>
            <h4 className="text-base font-bold mb-1">Upload Beneficiary List</h4>
            <p className="text-xs text-slate-500 mb-5 px-4 leading-relaxed">Drop your CSV or Excel file here to sync local data to the Prahar AI network.</p>
            <button className="bg-primary text-white px-8 py-3 rounded-xl text-sm font-bold w-full max-w-xs transition-transform active:scale-95 shadow-md">
              Select File
            </button>
          </div>
        </section>

        {/* Analytics */}
        <section>
          <h3 className="font-bold text-slate-800 mb-3 px-1">Impact Analytics</h3>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">Monthly Onboarding Trend</p>
                <h4 className="text-2xl font-bold text-primary">+2,840 <span className="text-xs font-normal text-green-600">↑ 12%</span></h4>
              </div>
              <div className="flex gap-1">
                {[12, 16, 20, 14, 24].map((h, i) => (
                  <div key={i} className={`w-1.5 rounded-t-full ${i === 4 ? 'bg-primary' : 'bg-primary/20'}`} style={{ height: `${h * 4}px` }} />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Demographic Reach (Rural)</span>
                  <span className="text-primary font-bold">84%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[84%]" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  <span className="text-xs font-semibold">5 Active Regions</span>
                </div>
                <button className="text-xs font-bold text-primary px-3 py-1 bg-primary/5 rounded-full">View Full Report</button>
              </div>
            </div>
          </div>
        </section>

        {/* Tools */}
        <section>
          <h3 className="font-bold text-slate-800 mb-3 px-1">Awareness Drive Tools</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: ImageIcon, title: 'Poster Templates', desc: 'Multilingual graphics', color: 'bg-blue-50 text-blue-600' },
              { icon: Mic, title: 'AI Voice Scripts', desc: 'For community radio', color: 'bg-green-50 text-green-600' },
              { icon: FileText, title: 'Handout Packs', desc: 'Offline printable PDF', color: 'bg-amber-50 text-amber-600' },
              { icon: Video, title: 'Video Modules', desc: 'Training workshops', color: 'bg-purple-50 text-purple-600' }
            ].map((tool, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-primary/5 shadow-sm flex flex-col items-center text-center group cursor-pointer hover:border-primary/30 transition-all">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${tool.color}`}>
                  <tool.icon className="size-5" />
                </div>
                <h5 className="text-xs font-bold mb-1">{tool.title}</h5>
                <p className="text-[10px] text-slate-500">{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary rounded-2xl p-6 text-white text-center relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-xl" />
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Scale Your Impact</h3>
            <p className="text-sm text-white/80 mb-6 px-4">Refer other NGOs or Panchayats and earn resource credits for your community.</p>
            <button className="bg-white text-primary px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-100 transition-colors">Become a Prahar Partner</button>
          </div>
        </section>
      </main>
    </div>
  );
}
