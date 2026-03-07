/**
 * India.gov.in Schemes API Service
 * Fetches real government schemes data from India.gov.in API
 */

// API Types
interface IndiaGovScheme {
  title: string;
  ministry: string | null;
  schemeCategory: string[];
  description: string;
  beneficiaryState: string | null;
  npiMinistry: string | null;
  slug: string;
  tags: string[];
  __typename: string;
}

interface IndiaGovResponse {
  schemesResponse: {
    total: number;
    results: IndiaGovScheme[];
    __typename: string;
  };
}

interface FetchSchemesOptions {
  categories?: string[];
  pageNumber?: number;
  pageSize?: number;
}

// Internal Types
export interface Scheme {
  schemeId: string;
  name: string;
  description: string;
  category: string[];
  ministry: string | null;
  tags: string[];
  state: string | null;
  schemeUrl: string | null; // Link to myscheme.gov.in application page
  page_scheme_id?: string | null;
  page_title?: string | null;
  page_ministry?: string | null;
  page_description?: string | null;
  page_eligibility_json?: string;
  page_benefits_json?: string;
  page_enriched_at?: string | null;
}

class IndiaGovService {
  private readonly API_URL =
    'https://www.india.gov.in/my-government/schemes/search/dataservices/getschemes';
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly REQUEST_TIMEOUT = 60000; // 60 seconds (large batch requests can be slow)
  private readonly MAX_RETRIES = 3;

  /**
   * Fetch schemes from India.gov.in API
   */
  async fetchSchemes(options: FetchSchemesOptions = {}): Promise<{
    total: number;
    schemes: Scheme[];
    page: number;
    pageSize: number;
  }> {
    const pageNumber = options.pageNumber || 1;
    const pageSize = options.pageSize || this.DEFAULT_PAGE_SIZE;

    let lastError: any;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        const response = await fetch(this.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: options.categories || [],
            mustFilter: [],
            pageNumber,
            pageSize,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as IndiaGovResponse;

        return {
          total: data.schemesResponse.total,
          schemes: data.schemesResponse.results.map(this.transformScheme),
          page: pageNumber,
          pageSize,
        };
      } catch (error: any) {
        lastError = error;
        if (attempt < this.MAX_RETRIES) {
          const backoff = attempt * 2000; // 2s, 4s
          console.warn(
            `⚠️  Fetch attempt ${attempt}/${this.MAX_RETRIES} failed (page ${pageNumber}): ${error.message}. Retrying in ${backoff / 1000}s...`
          );
          await this.delay(backoff);
        }
      }
    }

    console.error('Error fetching schemes from India.gov.in:', lastError);
    throw new Error(
      `Failed to fetch schemes after ${this.MAX_RETRIES} attempts: ${lastError.message}`
    );
  }

  /**
   * Fetch all schemes (paginated)
   */
  async fetchAllSchemes(batchSize: number = 100): Promise<Scheme[]> {
    const allSchemes: Scheme[] = [];
    let pageNumber = 1;
    let totalFetched = 0;
    let total = 0;
    const startedAt = Date.now();

    try {
      console.log(`🌐 Fetching schemes from India.gov.in with batchSize=${batchSize}...`);

      // First request to get total count
      const firstBatch = await this.fetchSchemes({
        pageNumber: 1,
        pageSize: batchSize,
      });

      total = firstBatch.total;
      allSchemes.push(...firstBatch.schemes);
      totalFetched = firstBatch.schemes.length;

      const totalPages = Math.ceil(total / batchSize);
      const firstPercent = ((totalFetched / total) * 100).toFixed(1);

      console.log(
        `📥 Fetch progress: page ${pageNumber}/${totalPages} | ${totalFetched}/${total} (${firstPercent}%)`
      );

      // Fetch remaining pages
      while (totalFetched < total) {
        pageNumber++;
        const batch = await this.fetchSchemes({
          pageNumber,
          pageSize: batchSize,
        });

        allSchemes.push(...batch.schemes);
        totalFetched += batch.schemes.length;

        const percent = ((totalFetched / total) * 100).toFixed(1);
        const totalPages = Math.ceil(total / batchSize);

        console.log(
          `📥 Fetch progress: page ${pageNumber}/${totalPages} | ${totalFetched}/${total} (${percent}%)`
        );

        // Add delay to avoid rate limiting
        await this.delay(500);
      }

      const durationSec = ((Date.now() - startedAt) / 1000).toFixed(2);
      console.log(`✅ India.gov fetch complete: ${allSchemes.length} schemes in ${durationSec}s`);

      return allSchemes;
    } catch (error: any) {
      console.error('Error fetching all schemes:', error);
      throw error;
    }
  }

  /**
   * Fetch schemes by category
   */
  async fetchSchemesByCategory(category: string): Promise<Scheme[]> {
    const result = await this.fetchSchemes({
      categories: [category],
      pageSize: 100,
    });

    return result.schemes;
  }

  /**
   * Search schemes by text
   */
  searchSchemes(schemes: Scheme[], query: string): Scheme[] {
    const lowerQuery = query.toLowerCase();

    return schemes.filter(
      (scheme) =>
        scheme.name.toLowerCase().includes(lowerQuery) ||
        scheme.description.toLowerCase().includes(lowerQuery) ||
        scheme.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Filter schemes by tags
   */
  filterByTags(schemes: Scheme[], tags: string[]): Scheme[] {
    const lowerTags = tags.map((t) => t.toLowerCase());

    return schemes.filter((scheme) =>
      scheme.tags.some((tag) => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Filter schemes by state
   */
  filterByState(schemes: Scheme[], state: string): Scheme[] {
    return schemes.filter(
      (scheme) =>
        scheme.state === state ||
        scheme.state === null || // National schemes
        scheme.tags.some((tag) => tag.toLowerCase().includes(state.toLowerCase()))
    );
  }

  /**
   * Transform API scheme to internal format
   */
  private transformScheme(apiScheme: IndiaGovScheme): Scheme {
    const slug = apiScheme.slug;
    return {
      schemeId: slug,
      name: apiScheme.title,
      description: apiScheme.description.trim(),
      category: apiScheme.schemeCategory,
      ministry: apiScheme.ministry,
      tags: apiScheme.tags,
      state: apiScheme.beneficiaryState,
      // Construct direct application URL from slug
      schemeUrl: slug ? `https://www.myscheme.gov.in/schemes/${slug}` : null,
    };
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get available categories
   */
  getAvailableCategories(): string[] {
    return [
      'Agriculture,Rural & Environment',
      'Education & Learning',
      'Skills & Employment',
      'Social welfare & Empowerment',
      'Health & Wellness',
      'Business & Entrepreneurship',
      'Travel & Tourism',
    ];
  }
}

export const indiaGovService = new IndiaGovService();
