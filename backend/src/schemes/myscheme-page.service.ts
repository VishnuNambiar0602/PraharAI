/**
 * MyScheme page enrichment service.
 *
 * Scrapes scheme detail pages from MyScheme.gov.in to extract:
 * - Title, ministry, description
 * - Eligibility criteria
 * - Benefits information
 */

type BasicScheme = {
  schemeId: string;
  name: string;
  description: string;
  category: string[];
  ministry: string | null;
  tags: string[];
  state: string | null;
  schemeUrl: string | null;
};

export type EnrichedScheme = BasicScheme & {
  page_scheme_id?: string | null;
  page_title?: string | null;
  page_ministry?: string | null;
  page_description?: string | null;
  page_eligibility_json?: string;
  page_benefits_json?: string;
  page_enriched_at?: string | null;
};

type PageApiConfig = {
  apiBaseUrl: string;
  apiKey: string;
};

class MySchemePageService {
  private readonly PAGE_BASE = 'https://www.myscheme.gov.in/schemes/';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private readonly LANG = 'en';
  private readonly MAX_CONCURRENCY = Math.max(
    1,
    Number(process.env.SCHEME_ENRICH_CONCURRENCY || 6)
  );
  private cachedConfig: PageApiConfig | null = null;

  private stripHtml(input: string): string {
    return String(input || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private collectStringLeaves(node: unknown, sink: string[]): void {
    if (typeof node === 'string') {
      const clean = this.stripHtml(node);
      if (clean.length > 30) sink.push(clean);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((value) => this.collectStringLeaves(value, sink));
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach((value) =>
        this.collectStringLeaves(value, sink)
      );
    }
  }

  private extractChunkUrlFromHtml(html: string): string | null {
    const match = html.match(
      /https:\/\/cdn\.myscheme\.in\/_next\/static\/chunks\/pages\/schemes\/%5Bslug%5D-[^"']+/i
    );
    return match?.[0] ?? null;
  }

  private extractApiConfigFromChunk(chunkJs: string): PageApiConfig | null {
    const baseMatch = chunkJs.match(
      /https:\/\/api\.myscheme\.gov\.in\/schemes\/v6\/public\/schemes/
    );
    const keyMatch = chunkJs.match(/x-api-key":"([^"]+)"/);
    if (!baseMatch || !keyMatch) return null;

    return {
      apiBaseUrl: baseMatch[0],
      apiKey: keyMatch[1],
    };
  }

  private async discoverApiConfig(seedSlug: string): Promise<PageApiConfig | null> {
    if (this.cachedConfig) return this.cachedConfig;

    try {
      const pageUrl = `${this.PAGE_BASE}${seedSlug}`;
      const pageResponse = await fetch(pageUrl, { headers: { 'user-agent': this.USER_AGENT } });
      if (!pageResponse.ok) {
        return null;
      }
      const html = await pageResponse.text();

      const chunkUrl = this.extractChunkUrlFromHtml(html);
      if (!chunkUrl) {
        return null;
      }

      const chunkResponse = await fetch(chunkUrl, { headers: { 'user-agent': this.USER_AGENT } });
      if (!chunkResponse.ok) {
        return null;
      }
      const chunkJs = await chunkResponse.text();

      const config = this.extractApiConfigFromChunk(chunkJs);
      if (!config) {
        return null;
      }

      this.cachedConfig = config;
      return config;
    } catch (err) {
      return null;
    }
  }

  private buildEligibilitySignals(strings: string[]): string[] {
    return strings
      .filter((s) =>
        /(eligib|who can apply|income|age|student|farmer|women|sc|st|obc|pwd|caste|criteria)/i.test(
          s
        )
      )
      .slice(0, 20);
  }

  private buildBenefitSignals(strings: string[]): string[] {
    return strings
      .filter((s) =>
        /(benefit|subsidy|assistance|support|grant|coverage|loan|scholarship)/i.test(s)
      )
      .slice(0, 20);
  }

  private async enrichOneWithStats(
    scheme: BasicScheme,
    config: PageApiConfig,
    errorStats: Record<string, number>
  ): Promise<EnrichedScheme> {
    const base: EnrichedScheme = {
      ...scheme,
      page_scheme_id: null,
      page_title: null,
      page_ministry: null,
      page_description: null,
      page_eligibility_json: '[]',
      page_benefits_json: '[]',
      page_enriched_at: null,
    };

    const trackError = (reason: string) => {
      errorStats[reason] = (errorStats[reason] || 0) + 1;
    };

    try {
      const url = `${config.apiBaseUrl}?slug=${encodeURIComponent(scheme.schemeId)}&lang=${this.LANG}`;
      const response = await fetch(url, {
        headers: {
          'x-api-key': config.apiKey,
          'user-agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        trackError(`HTTP ${response.status}`);
        return base;
      }

      const payload: any = await response.json();
      const data = payload?.data;
      if (!data || typeof data !== 'object') {
        trackError('Empty or invalid data');
        return base;
      }

      const textPool: string[] = [];
      this.collectStringLeaves(data, textPool);

      const title =
        this.stripHtml(String(data?.schemeName || data?.title || '')).slice(0, 500) ||
        this.stripHtml(scheme.name).slice(0, 500);
      const ministry =
        this.stripHtml(String(data?.schemeAddedById?.name || data?.ministry || '')).slice(0, 400) ||
        scheme.ministry ||
        null;
      const pageDescription = this.stripHtml(
        String(data?.schemeContent || data?.description || scheme.description || '')
      ).slice(0, 5000);

      const uniqueStrings = Array.from(new Set(textPool));
      const eligibility = this.buildEligibilitySignals(uniqueStrings);
      const benefits = this.buildBenefitSignals(uniqueStrings);

      return {
        ...scheme,
        page_scheme_id: data?._id ? String(data._id) : null,
        page_title: title || null,
        page_ministry: ministry,
        page_description: pageDescription || null,
        page_eligibility_json: JSON.stringify(eligibility),
        page_benefits_json: JSON.stringify(benefits),
        page_enriched_at: new Date().toISOString(),
      };
    } catch (err) {
      const errorType = err instanceof Error ? err.constructor.name : 'Unknown error';
      trackError(errorType);
      return base;
    }
  }

  async enrichSchemes(schemes: BasicScheme[]): Promise<EnrichedScheme[]> {
    if (!schemes.length) return [];

    // Try discovery with first 10 schemes (some may not have MyScheme pages)
    const maxDiscoveryAttempts = Math.min(10, schemes.length);
    let config: PageApiConfig | null = null;
    
    for (let i = 0; i < maxDiscoveryAttempts; i++) {
      config = await this.discoverApiConfig(schemes[i].schemeId);
      if (config) {
        console.log(`✅ API config discovered using scheme #${i + 1}: ${schemes[i].schemeId}`);
        break;
      }
    }

    if (!config) {
      console.warn(`⚠️  Could not discover MyScheme page API config after ${maxDiscoveryAttempts} attempts; skipping page enrichment.`);
      return schemes;
    }

    console.log(`🕸️  Enriching ${schemes.length} schemes from MyScheme page API...`);

    const results: EnrichedScheme[] = new Array(schemes.length);
    const errorStats: Record<string, number> = {};
    let index = 0;

    const worker = async () => {
      while (true) {
        const i = index;
        index += 1;
        if (i >= schemes.length) break;

        const result = await this.enrichOneWithStats(schemes[i], config!, errorStats);
        results[i] = result;
      }
    };

    const workers = Array.from({ length: Math.min(this.MAX_CONCURRENCY, schemes.length) }, () =>
      worker()
    );
    await Promise.all(workers);

    const enrichedCount = results.filter((s) => s.page_scheme_id).length;
    console.log(`✅ Page enrichment done: ${enrichedCount}/${schemes.length} schemes enriched`);

    if (Object.keys(errorStats).length > 0) {
      console.log('📊 Enrichment failure breakdown:');
      Object.entries(errorStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
          console.log(`   ${reason}: ${count}`);
        });
    }

    return results;
  }
}

export const mySchemePageService = new MySchemePageService();
