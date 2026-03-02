import { motion } from 'motion/react';
import { User, MapPin, ShieldCheck, Edit3, ClipboardList, CheckCircle2, Calendar, FileText, Upload, Download, Eye, Bot } from 'lucide-react';

export default function UserProfile() {
  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white p-4 border-b border-primary/10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-primary text-white rounded-lg flex items-center justify-center">
            <Bot className="size-6" />
          </div>
          <h1 className="font-bold text-primary text-lg">Prahar AI</h1>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-primary/5 rounded-full text-primary text-xs font-bold">
          हिंदी
        </button>
      </header>

      <main className="p-4 space-y-6 pb-24 max-w-2xl mx-auto w-full">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-primary/5 relative overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div className="relative">
              <div className="size-20 rounded-full bg-slate-200 overflow-hidden border-4 border-primary/5">
                <img 
                  src="https://picsum.photos/seed/rahul/200/200" 
                  alt="Rahul Kumar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-1 right-1 size-4 bg-green-500 border-2 border-white rounded-full" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Rahul Kumar</h2>
                <button className="text-primary p-1 hover:bg-primary/5 rounded-lg">
                  <Edit3 className="size-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <User className="size-3" />
                  Age: 28
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="size-3" />
                  Income: ₹2.5L
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  Uttar Pradesh
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aadhar Verified</span>
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              <ShieldCheck className="size-3" />
              1234 XXXX 9012
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-primary/5">
            <div className="size-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
              <ClipboardList className="size-6" />
            </div>
            <p className="text-3xl font-black text-slate-900">05</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Eligible Schemes</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-primary/5">
            <div className="size-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-3">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-3xl font-black text-slate-900">02</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Applied</p>
          </div>
        </div>

        {/* Deadline Alert */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-primary/5 flex items-center gap-4">
          <div className="size-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Calendar className="size-7" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-black text-slate-900">01</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upcoming Deadline</p>
          </div>
          <div className="bg-amber-100/50 p-3 rounded-xl border border-amber-200">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">UP Scholarship Portal</p>
            <p className="text-xs font-bold text-amber-600">Closes in 3 days</p>
          </div>
        </div>

        {/* Active Applications */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-bold text-primary">Active Applications</h3>
            <button className="text-xs font-bold text-primary hover:underline">View All</button>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-900">PM Awas Yojana (Rural)</h4>
                <p className="text-xs text-slate-500 mt-1">Application ID: #PM-882910</p>
              </div>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Processing</span>
            </div>
            
            <div className="relative px-2">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2" />
              <div className="absolute top-1/2 left-0 w-1/3 h-1 bg-primary -translate-y-1/2" />
              <div className="flex justify-between relative z-10">
                {[
                  { label: 'Submitted', active: true },
                  { label: 'Verified', active: true },
                  { label: 'Approved', active: false },
                  { label: 'Fund Transfer', active: false }
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`size-4 rounded-full border-2 ${
                      step.active ? 'bg-primary border-primary' : 'bg-white border-slate-200'
                    }`} />
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${
                      step.active ? 'text-primary' : 'text-slate-400'
                    }`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full flex items-center justify-between p-3 bg-primary/5 rounded-xl text-xs font-bold text-primary">
              <span>Next Step: Verification by Block Officer</span>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Required Documents */}
        <div>
          <h3 className="font-bold text-primary mb-4 px-1">Required Documents</h3>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-xl border border-primary/5 shadow-sm flex items-center gap-4">
              <div className="size-10 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center">
                <FileText className="size-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900">Income Certificate</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required for 3 schemes</p>
              </div>
              <button className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">Upload</button>
            </div>
            <div className="bg-white p-4 rounded-xl border border-primary/5 shadow-sm flex items-center gap-4">
              <div className="size-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="size-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900">Aadhar Card</h4>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Verified</p>
              </div>
              <button className="text-primary p-2 hover:bg-primary/5 rounded-lg">
                <Eye className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Download Forms */}
        <div>
          <h3 className="font-bold text-primary mb-4 px-1">Download Forms</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {[
              { title: 'Farmer Subsidy Application', size: '1.2 MB' },
              { title: 'Birth Registration Form', size: '840 KB' }
            ].map((form, i) => (
              <div key={i} className="min-w-[200px] bg-white p-5 rounded-2xl border border-primary/5 shadow-sm space-y-4">
                <div className="size-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                  <FileText className="size-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{form.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">PDF • {form.size}</p>
                </div>
                <button className="w-full border border-primary/20 text-primary py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/5">
                  <Download className="size-3" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
    </svg>
  );
}
