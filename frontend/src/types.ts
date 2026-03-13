export type View =
  | 'home'
  | 'schemes'
  | 'assistant'
  | 'profile'
  | 'admin'
  | 'about'
  | 'partner'
  | 'login'
  | 'schemeDetail';

export interface SchemeReference {
  title: string;
  url: string;
}

export interface SchemeApplicationProcess {
  mode: string;
  steps: string[];
  markdown: string;
}

export interface SchemePageDetails {
  schemeId: string | null;
  title: string | null;
  ministry: string | null;
  description: string | null;
  eligibility: string[];
  benefits: string[];
  references?: SchemeReference[];
  applicationProcess?: SchemeApplicationProcess[];
  eligibilityMarkdown?: string | null;
  benefitsMarkdown?: string | null;
  descriptionMarkdown?: string | null;
  exclusionsMarkdown?: string | null;
  raw?: Record<string, unknown>;
  enrichedAt?: string | null;
}

export interface SchemeEnrichmentMeta {
  hasPageDetails: boolean;
  enrichedAt: string | null;
}

export interface Scheme {
  id: string;
  title: string;
  description?: string;
  category: string;
  ministry?: string;
  state?: string;
  benefits?: string;
  eligibility?: string;
  applicationUrl?: string; // Direct link to apply on myscheme.gov.in
  tags?: string[];
  rawCategories?: string[];
  matchedCategories?: Array<{
    type: string;
    value: string;
  }>;
  enrichment?: SchemeEnrichmentMeta;
  pageDetails?: SchemePageDetails;
  eligibilityCriteria?: string[];
  benefitsList?: string[];
  applicationProcess?: string;
  requiredDocuments?: string[];
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
  language?: string;
  suggestions?: string[];
  schemes?: Scheme[];
}
