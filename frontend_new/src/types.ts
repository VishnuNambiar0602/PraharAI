export type View = 'home' | 'schemes' | 'assistant' | 'profile' | 'about' | 'partner' | 'contact';

export interface Scheme {
  id: string;
  title: string;
  benefit: string;
  eligibility: string;
  deadline: string;
  category: 'Farmer' | 'Student' | 'Women' | 'Health' | 'General';
  status?: 'Active' | 'Applied' | 'Processing';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
  schemes?: Scheme[];
}
