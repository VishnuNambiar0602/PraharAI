export type View =
  | 'home'
  | 'schemes'
  | 'assistant'
  | 'profile'
  | 'about'
  | 'partner'
  | 'contact'
  | 'login'
  | 'schemeDetail';

export interface Scheme {
  id: string;
  title: string;
  description?: string;
  category: string;
  state?: string;
  benefits?: string;
  eligibility: string;
  applicationUrl?: string; // Direct link to apply on myscheme.gov.in
  /** @deprecated kept for backwards compat with mock data */
  benefit?: string;
  deadline?: string;
  status?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
  schemes?: Scheme[];
}
