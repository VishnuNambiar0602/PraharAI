/**
 * Properly structured MyScheme data extraction service
 * Based on actual API response structure analysis
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
  page_references_json?: string;
  page_application_process_json?: string;
  page_eligibility_md?: string | null;
  page_benefits_md?: string | null;
  page_description_md?: string | null;
  page_exclusions_md?: string | null;
  page_scheme_raw_json?: string;
  page_enriched_at?: string | null;
};

type PageApiConfig = {
  apiBaseUrl: string;
  apiKey: string;
};

// Rich text node types used by MyScheme
type RichTextNode = {
  type?: string;
  text?: string;
  children?: RichTextNode[];
  bold?: boolean;
  italic?: boolean;
  link?: string;
  [key: string]: any;
};

type SchemeReference = {
  title: string;
  url: string;
};

type ApplicationProcessItem = {
  mode: string;
  steps: string[];
  markdown: string;
};

class MySchemeStructuredService {
  private readonly PAGE_BASE = 'https://www.myscheme.gov.in/schemes/';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private readonly LANG = 'en';
  private readonly MAX_RETRIES = Math.max(0, Number(process.env.SCHEME_ENRICH_MAX_RETRIES || 3));
  private readonly RETRY_BASE_DELAY_MS = Math.max(
    100,
    Number(process.env.SCHEME_ENRICH_RETRY_BASE_MS || 400)
  );
  private readonly MAX_CONCURRENCY = Math.max(
    1,
    Number(process.env.SCHEME_ENRICH_CONCURRENCY || 3)
  );
  private readonly MIN_REQUEST_GAP_MS = Math.max(
    0,
    Number(process.env.SCHEME_ENRICH_MIN_REQUEST_GAP_MS || 220)
  );
  private readonly RATE_LIMIT_COOLDOWN_MS = Math.max(
    250,
    Number(process.env.SCHEME_ENRICH_RATE_LIMIT_COOLDOWN_MS || 3000)
  );
  private readonly MAX_RATE_LIMIT_COOLDOWN_MS = Math.max(
    this.RATE_LIMIT_COOLDOWN_MS,
    Number(process.env.SCHEME_ENRICH_MAX_RATE_LIMIT_COOLDOWN_MS || 30000)
  );
  private cachedConfig: PageApiConfig | null = null;
  private nextRequestAllowedAt = 0;
  private consecutiveRateLimited = 0;
  private totalRateLimitedResponses = 0;

  /**
   * Parse rich-text nodes into clean text strings
   */
  private parseRichText(nodes: RichTextNode[] | undefined): string {
    if (!nodes || !Array.isArray(nodes)) return '';

    const extractText = (node: RichTextNode): string => {
      if (node.text) return String(node.text);
      if (node.children && Array.isArray(node.children)) {
        return node.children.map(extractText).join('');
      }
      return '';
    };

    return nodes.map(extractText).join(' ').trim();
  }

  /**
   * Extract list items from rich-text structure
   */
  private extractListItems(nodes: RichTextNode[] | undefined): string[] {
    if (!nodes || !Array.isArray(nodes)) return [];

    const items: string[] = [];

    const traverse = (node: RichTextNode) => {
      if (node.type === 'list_item' && node.children) {
        const text = this.parseRichText(node.children).trim();
        if (text && text.length > 10) {
          items.push(text);
        }
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return items;
  }

  /**
   * Clean and filter eligibility criteria
   */
  private cleanEligibility(items: string[]): string[] {
    return items
      .filter((item) => {
        const lower = item.toLowerCase();
        // Filter out noise
        if (lower.includes('http://') || lower.includes('https://')) return false;
        if (item.length < 20 || item.length > 500) return false;
        if (/^[A-Z\s]+$/.test(item)) return false; // ALL CAPS (likely titles)
        return true;
      })
      .map((item) => item.trim())
      .filter((item, index, self) => self.indexOf(item) === index) // dedupe
      .slice(0, 15); // max 15 criteria
  }

  /**
   * Clean and filter benefits
   */
  private cleanBenefits(items: string[]): string[] {
    return items
      .filter((item) => {
        const lower = item.toLowerCase();
        // Filter out noise
        if (lower.includes('http://') || lower.includes('https://')) return false;
        if (item.length < 15 || item.length > 800) return false;
        return true;
      })
      .map((item) => item.trim())
      .filter((item, index, self) => self.indexOf(item) === index) // dedupe
      .slice(0, 10); // max 10 benefits
  }

  private cleanReferences(refs: unknown): SchemeReference[] {
    if (!Array.isArray(refs)) return [];
    const dedupe = new Set<string>();
    const cleaned: SchemeReference[] = [];

    for (const ref of refs) {
      const title = String((ref as any)?.title || '').trim();
      const url = String((ref as any)?.url || '').trim();
      if (!title && !url) continue;
      if (url && !/^https?:\/\//i.test(url)) continue;

      const key = `${title.toLowerCase()}|${url.toLowerCase()}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      cleaned.push({
        title: title.slice(0, 300),
        url: url.slice(0, 1000),
      });
    }

    return cleaned.slice(0, 25);
  }

  private cleanApplicationProcess(raw: unknown): ApplicationProcessItem[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .map((entry) => {
        const mode = String((entry as any)?.mode || '').trim();
        const markdown = String((entry as any)?.process_md || '').trim();
        const processNodes = Array.isArray((entry as any)?.process)
          ? ((entry as any).process as RichTextNode[])
          : [];

        const parsed = processNodes
          .map((node) => this.parseRichText([node]))
          .map((step) => step.trim())
          .filter((step) => step.length > 0)
          .slice(0, 40);

        return {
          mode: mode || 'General',
          steps: parsed,
          markdown: markdown.slice(0, 10000),
        };
      })
      .filter((entry) => entry.steps.length > 0 || entry.markdown.length > 0)
      .slice(0, 8);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForRequestSlot(): Promise<void> {
    const now = Date.now();
    const slotAt = Math.max(now, this.nextRequestAllowedAt);
    this.nextRequestAllowedAt = slotAt + this.MIN_REQUEST_GAP_MS;

    const waitMs = slotAt - now;
    if (waitMs > 0) {
      await this.delay(waitMs);
    }
  }

  private applyGlobalCooldown(ms: number): void {
    const until = Date.now() + ms;
    this.nextRequestAllowedAt = Math.max(this.nextRequestAllowedAt, until);
  }

  private async fetchWithRetry(url: string, config: PageApiConfig): Promise<Response> {
    let attempt = 0;
    while (true) {
      await this.waitForRequestSlot();

      const response = await fetch(url, {
        headers: {
          'x-api-key': config.apiKey,
          'user-agent': this.USER_AGENT,
        },
      });

      if (response.status !== 429) {
        if (this.consecutiveRateLimited > 0) {
          this.consecutiveRateLimited = 0;
        }
        return response;
      }

      this.totalRateLimitedResponses += 1;
      this.consecutiveRateLimited += 1;

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 0;
      const baseBackoffMs =
        retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : this.RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 250);

      const adaptiveCooldownMs = Math.min(
        this.MAX_RATE_LIMIT_COOLDOWN_MS,
        this.RATE_LIMIT_COOLDOWN_MS * Math.max(1, this.consecutiveRateLimited)
      );
      const cooldownMs = Math.max(baseBackoffMs, adaptiveCooldownMs);

      this.applyGlobalCooldown(cooldownMs);

      if (this.totalRateLimitedResponses <= 5 || this.totalRateLimitedResponses % 50 === 0) {
        console.warn(
          `⏳ Rate limited (429): count=${this.totalRateLimitedResponses}, consecutive=${this.consecutiveRateLimited}, cooldown=${cooldownMs}ms`
        );
      }

      if (attempt >= this.MAX_RETRIES) {
        return response;
      }

      await this.delay(cooldownMs);
      attempt += 1;
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
      page_references_json: '[]',
      page_application_process_json: '[]',
      page_eligibility_md: null,
      page_benefits_md: null,
      page_description_md: null,
      page_exclusions_md: null,
      page_scheme_raw_json: '{}',
      page_enriched_at: null,
    };

    const trackError = (reason: string) => {
      errorStats[reason] = (errorStats[reason] || 0) + 1;
    };

    try {
      const url = `${config.apiBaseUrl}?slug=${encodeURIComponent(scheme.schemeId)}&lang=${this.LANG}`;
      const response = await this.fetchWithRetry(url, config);

      if (!response.ok) {
        trackError(`HTTP ${response.status}`);
        return base;
      }

      const payload: any = await response.json();
      const rawData = payload?.data;
      if (!rawData || typeof rawData !== 'object') {
        trackError('Empty or invalid data');
        return base;
      }

      // Extract structured data from the proper fields
      const enData = rawData.en || {};
      const basicDetails = enData.basicDetails || {};
      const schemeContent = enData.schemeContent || {};
      const eligibilityCriteria = enData.eligibilityCriteria || {};
      const applicationProcess = enData.applicationProcess || [];

      // Basic info
      const title = String(basicDetails.schemeName || scheme.name || '')
        .trim()
        .slice(0, 500);
      const ministry =
        String(
          basicDetails.nodalDepartmentName?.label ||
            basicDetails.schemeAddedById?.name ||
            scheme.ministry ||
            ''
        )
          .trim()
          .slice(0, 400) || null;

      // Description from proper field
      const briefDesc = String(schemeContent.briefDescription || '').trim();
      const detailedDesc = this.parseRichText(schemeContent.detailedDescription);
      const pageDescription = (briefDesc || detailedDesc || scheme.description).slice(0, 5000);

      // Eligibility from structured list
      const eligibilityNodes = eligibilityCriteria.eligibilityDescription || [];
      const rawEligibility = this.extractListItems(eligibilityNodes);
      const cleanedEligibility = this.cleanEligibility(rawEligibility);

      // Benefits from structured list
      const benefitNodes = schemeContent.benefits || [];
      const rawBenefits = this.extractListItems(benefitNodes);
      const cleanedBenefits = this.cleanBenefits(rawBenefits);

      const cleanedReferences = this.cleanReferences(schemeContent.references);
      const cleanedApplicationProcess = this.cleanApplicationProcess(applicationProcess);

      // Also extract benefit text description if list is empty
      if (cleanedBenefits.length === 0) {
        const benefitsText = this.parseRichText(benefitNodes);
        if (benefitsText.length > 20) {
          cleanedBenefits.push(benefitsText.slice(0, 500));
        }
      }

      return {
        ...scheme,
        page_scheme_id: rawData._id ? String(rawData._id) : null,
        page_title: title || null,
        page_ministry: ministry,
        page_description: pageDescription || null,
        page_eligibility_json: JSON.stringify(cleanedEligibility),
        page_benefits_json: JSON.stringify(cleanedBenefits),
        page_references_json: JSON.stringify(cleanedReferences),
        page_application_process_json: JSON.stringify(cleanedApplicationProcess),
        page_eligibility_md:
          String(eligibilityCriteria.eligibilityDescription_md || '').trim() || null,
        page_benefits_md: String(schemeContent.benefits_md || '').trim() || null,
        page_description_md: String(schemeContent.detailedDescription_md || '').trim() || null,
        page_exclusions_md: String(schemeContent.exclusions_md || '').trim() || null,
        page_scheme_raw_json: JSON.stringify({
          basicDetails,
          schemeContent,
          applicationProcess,
          schemeDefinitions: enData.schemeDefinitions || [],
          eligibilityCriteria,
        }),
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

    // Reset per-run adaptive limiter counters.
    this.nextRequestAllowedAt = 0;
    this.consecutiveRateLimited = 0;
    this.totalRateLimitedResponses = 0;

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
      console.warn(
        `⚠️  Could not discover MyScheme page API config after ${maxDiscoveryAttempts} attempts; skipping page enrichment.`
      );
      return schemes;
    }

    console.log(`🕸️  Enriching ${schemes.length} schemes from MyScheme page API...`);

    const results: EnrichedScheme[] = new Array(schemes.length);
    const errorStats: Record<string, number> = {};
    const startedAt = Date.now();
    let processed = 0;
    let successCount = 0;
    let failureCount = 0;
    let lastLoggedProcessed = 0;
    const progressStep = Math.max(25, Math.floor(schemes.length / 100));

    const logProgress = (force = false) => {
      if (!force && processed - lastLoggedProcessed < progressStep) return;

      lastLoggedProcessed = processed;
      const elapsedMs = Date.now() - startedAt;
      const percent = ((processed / schemes.length) * 100).toFixed(1);
      const ratePerSec = elapsedMs > 0 ? processed / (elapsedMs / 1000) : 0;
      const remaining = schemes.length - processed;
      const etaSec = ratePerSec > 0 ? remaining / ratePerSec : 0;

      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      const etaText = Number.isFinite(etaSec) ? `${etaSec.toFixed(1)}s` : 'n/a';

      console.log(
        `📈 Enrich progress: ${processed}/${schemes.length} (${percent}%) | success=${successCount} failed=${failureCount} | elapsed=${elapsedSec}s eta=${etaText}`
      );
    };

    console.log(
      `⚙️  Enrichment settings: concurrency=${Math.min(this.MAX_CONCURRENCY, schemes.length)}, maxRetries=${this.MAX_RETRIES}, retryBaseDelayMs=${this.RETRY_BASE_DELAY_MS}, minRequestGapMs=${this.MIN_REQUEST_GAP_MS}, rateLimitCooldownMs=${this.RATE_LIMIT_COOLDOWN_MS}`
    );

    let index = 0;

    const worker = async () => {
      while (true) {
        const i = index;
        index += 1;
        if (i >= schemes.length) break;

        const result = await this.enrichOneWithStats(schemes[i], config!, errorStats);
        results[i] = result;

        processed += 1;
        if (result.page_scheme_id) {
          successCount += 1;
        } else {
          failureCount += 1;
        }
        logProgress(false);
      }
    };

    const workers = Array.from({ length: Math.min(this.MAX_CONCURRENCY, schemes.length) }, () =>
      worker()
    );
    await Promise.all(workers);

    logProgress(true);

    const enrichedCount = results.filter((s) => s.page_scheme_id).length;
    const totalDurationSec = ((Date.now() - startedAt) / 1000).toFixed(2);
    console.log(
      `✅ Page enrichment done: ${enrichedCount}/${schemes.length} schemes enriched in ${totalDurationSec}s`
    );

    if (Object.keys(errorStats).length > 0) {
      console.log('📊 Enrichment failure breakdown:');
      Object.entries(errorStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
          console.log(`   ${reason}: ${count}`);
        });
    }

    if (this.totalRateLimitedResponses > 0) {
      console.log(
        `📉 Rate limit summary: observed ${this.totalRateLimitedResponses} HTTP 429 responses during enrichment`
      );
    }

    return results;
  }
}

export const mySchemeStructuredService = new MySchemeStructuredService();
