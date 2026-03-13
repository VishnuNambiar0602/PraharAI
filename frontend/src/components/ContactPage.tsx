import { useState } from 'react';
import { PhoneCall, MessageSquare, MapPin, Building2, ChevronDown, Send, Mail, Clock } from 'lucide-react';
import { View } from '../types';

const FAQS = [
  { q: "How do I track my application?", a: "Log into the Prahar AI portal with your registered phone number and click 'Track Requests' in the dashboard to see real-time status updates." },
  { q: "What are the operating hours?", a: "Our AI support is available 24/7. Phone support is active Monday to Saturday, 9:00 AM to 6:00 PM IST." },
  { q: "Is my data secure?", a: "Yes — Prahar AI uses enterprise-grade encryption. We never share your personal data with third parties without explicit consent." },
  { q: "Can I speak to a human agent?", a: "Absolutely. If our AI cannot resolve your query, you can request a callback or use the Toll-Free number to connect with our support team directly." },
];

interface ContactPageProps {
  onNavigate: (view: View) => void;
}

export default function ContactPage({ onNavigate }: ContactPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-surface">

      {/* Hero */}
      <div className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="max-w-5xl mx-auto px-6 py-16 relative z-10 text-center">
          <h1 className="font-display text-4xl font-bold text-white mb-3">How can we help?</h1>
          <p className="text-white/60 text-lg">Reach out via any channel below — we respond within 24 hours.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 max-w-md mx-auto">
            <button className="flex-1 flex items-center justify-center gap-2 rounded-xl h-12 bg-accent text-white font-semibold transition-all hover:brightness-110 shadow-lg">
              <PhoneCall className="size-4" /> Toll-Free Call
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 rounded-xl h-12 bg-[#25D366] text-white font-semibold transition-all hover:brightness-110 shadow-lg">
              <MessageSquare className="size-4" /> WhatsApp Support
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* Contact Channels */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: PhoneCall, title: 'Phone Support', sub: '1800-XXX-XXXX', note: 'Mon–Sat, 9am–6pm', color: 'bg-blue-50 text-blue-600' },
            { icon: Mail, title: 'Email Us', sub: 'support@prahar.ai', note: 'Response within 24 hrs', color: 'bg-primary-50 text-primary' },
            { icon: Clock, title: 'AI Assistant', sub: '24/7 Support', note: 'Always online', color: 'bg-green-50 text-green-600' },
          ].map(({ icon: Icon, title, sub, note, color }) => (
            <div key={title} className="card p-6 text-center">
              <div className={`size-12 rounded-xl ${color} mx-auto flex items-center justify-center mb-4`}>
                <Icon className="size-5" />
              </div>
              <h4 className="font-semibold text-ink">{title}</h4>
              <p className="text-primary font-bold text-sm mt-1">{sub}</p>
              <p className="text-xs text-muted mt-1">{note}</p>
            </div>
          ))}
        </div>

        {/* Form + Offices */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink mb-2">Submit a Query</h2>
            <p className="text-muted mb-6">Tell us how we can help and we will get back to you promptly.</p>
            <div className="card p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Full Name</label>
                <input className="input-base" placeholder="e.g. Priya Sharma" type="text" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Phone Number</label>
                <input className="input-base" placeholder="+91 00000 00000" type="tel" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Your Message</label>
                <textarea className="input-base !h-auto resize-none" placeholder="How can Prahar AI assist you today?" rows={4} />
              </div>
              <button className="btn-primary w-full flex items-center justify-center gap-2">
                <Send className="size-4" /> Send Message
              </button>
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-ink mb-2">Our Offices</h2>
            <p className="text-muted mb-6">Visit us or send correspondence to our regional centers.</p>
            <div className="space-y-4">
              <div className="card p-5 flex gap-4">
                <div className="size-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <MapPin className="size-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-ink">Head Office</h4>
                  <p className="text-sm text-muted mt-1 leading-relaxed">Prahar Tower, 4th Floor, Tech Park Road, Bangalore, Karnataka — 560001</p>
                  <button className="text-primary text-sm font-semibold mt-2 hover:underline">Get Directions →</button>
                </div>
              </div>
              <div className="card p-5 flex gap-4">
                <div className="size-10 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">
                  <Building2 className="size-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold text-ink">Regional Support Center</h4>
                  <p className="text-sm text-muted mt-1 leading-relaxed">Civil Lines, Sector 12, Jaipur, Rajasthan — 302001</p>
                  <button className="text-primary text-sm font-semibold mt-2 hover:underline">Get Directions →</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto pb-8">
          <h2 className="font-display text-2xl font-bold text-ink mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-ink hover:bg-surface transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={`size-5 text-muted transition-transform shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted leading-relaxed border-t border-border pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
