import { motion } from 'motion/react';
import { PhoneCall, MessageSquare, ArrowLeft, MapPin, Building2, ChevronDown, Send, Home, LayoutGrid, Bot, Contact2, User } from 'lucide-react';
import { useState } from 'react';
import { View } from '../types';

interface ContactPageProps {
  onNavigate: (view: View) => void;
}

export default function ContactPage({ onNavigate }: ContactPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "How to track my application?", a: "You can track your application status by logging into the Prahar AI portal with your registered mobile number and clicking on 'Track Requests' in the dashboard." },
    { q: "What are the operating hours?", a: "Our digital support via Prahar AI is available 24/7. Phone support is active Monday to Saturday, 9:00 AM to 6:00 PM." },
    { q: "Is my data secure?", a: "Yes, Prahar AI uses enterprise-grade encryption to protect your personal data and query history. We never share your details with third parties." },
    { q: "Can I talk to a human agent?", a: "Absolutely. If our AI cannot resolve your query, you can request a call-back or use the Toll-Free button to speak directly with our support team." }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="flex items-center bg-white p-4 border-b border-primary/10 sticky top-0 z-10">
        <button 
          onClick={() => onNavigate('home')}
          className="text-primary flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-primary/10 transition-colors"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h2 className="text-slate-900 text-lg font-bold flex-1 text-center pr-10">Contact Us</h2>
      </header>

      <main className="flex-1 pb-24">
        {/* Hero Section */}
        <div className="px-4 py-12 bg-white text-center">
          <h3 className="text-slate-900 tracking-tight text-3xl font-black leading-tight">How can we help?</h3>
          <p className="text-slate-500 mt-2 text-sm">Reach out to us via any of the channels below</p>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-10 max-w-md mx-auto">
            <button className="flex-1 flex items-center justify-center gap-2 rounded-2xl h-14 bg-primary text-white text-base font-bold transition-transform active:scale-95 shadow-lg shadow-primary/20">
              <PhoneCall className="size-5" />
              <span className="truncate">Toll-Free Call</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 rounded-2xl h-14 bg-[#25D366] text-white text-base font-bold transition-transform active:scale-95 shadow-lg shadow-green-500/20">
              <MessageSquare className="size-5" />
              <span className="truncate">WhatsApp Support</span>
            </button>
          </div>
        </div>

        {/* Inquiry Form */}
        <div className="px-4 py-8 max-w-md mx-auto">
          <h2 className="text-primary text-xl font-bold mb-6">Submit a Query</h2>
          <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-primary/5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
              <input className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 text-sm focus:border-primary focus:ring-primary" placeholder="Enter your name" type="text" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
              <input className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 text-sm focus:border-primary focus:ring-primary" placeholder="+91 00000 00000" type="tel" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Your Message</label>
              <textarea className="w-full rounded-xl border-slate-100 bg-slate-50 p-4 text-sm focus:border-primary focus:ring-primary" placeholder="How can Prahar AI assist you today?" rows={4}></textarea>
            </div>
            <button className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-2 transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2">
              <Send className="size-4" />
              Send Message
            </button>
          </div>
        </div>

        {/* Office Locations */}
        <div className="px-4 py-12 bg-primary/5">
          <div className="max-w-md mx-auto">
            <h2 className="text-slate-900 text-xl font-bold mb-6">Our Offices</h2>
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-primary/10 flex gap-4 items-start shadow-sm">
                <div className="bg-primary/10 p-3 rounded-xl text-primary">
                  <MapPin className="size-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">Head Office</h4>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">Prahar Tower, 4th Floor, Tech Park Road, Bangalore, Karnataka - 560001</p>
                  <button className="text-primary text-sm font-bold mt-3 inline-block hover:underline">Get Directions →</button>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-primary/10 flex gap-4 items-start shadow-sm">
                <div className="bg-primary/10 p-3 rounded-xl text-primary">
                  <Building2 className="size-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">Regional Support Center</h4>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">Civil Lines, Sector 12, Jaipur, Rajasthan - 302001</p>
                  <button className="text-primary text-sm font-bold mt-3 inline-block hover:underline">Get Directions →</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="px-4 py-12 max-w-md mx-auto">
          <h2 className="text-slate-900 text-xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-slate-900"
                >
                  {faq.q}
                  <ChevronDown className={`size-5 text-primary transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
