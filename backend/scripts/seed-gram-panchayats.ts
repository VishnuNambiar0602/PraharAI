#!/usr/bin/env tsx
/**
 * LGD Village / Gram Panchayat Seeder
 * ──────────────────────────────────────────────────────────────
 * Fetches official LGD (Local Government Directory) village data
 * from data.gov.in (resource f17a1608-5f10-4610-bb50-a63c80d83974,
 * "LGD – Villages with PIN Codes") and seeds Neo4j as GramPanchayat
 * nodes so citizens can select their village/panchayat during
 * registration.
 *
 * Dataset fields (camelCase):
 *   stateCode | stateNameEnglish | districtCode | districtNameEnglish |
 *   subdistrictCode | subdistrictNameEnglish | villageCode |
 *   villageNameEnglish | pincode
 *
 * ─── Setup ───────────────────────────────────────────────────
 * Ensure these exist in backend/.env:
 *   DATA_GOV_IN_API_KEY=<your-key>      (from data.gov.in)
 *   LGD_GP_RESOURCE_ID=f17a1608-5f10-4610-bb50-a63c80d83974
 *
 * Run:
 *   npm run db:seed:gp -w backend
 *   npm run db:seed:gp -w backend -- --state "Jharkhand"
 *   npm run db:seed:gp -w backend -- --state "Jharkhand" --clear
 *
 * ─── Flags ───────────────────────────────────────────────────
 *   --clear              Remove all GramPanchayat nodes before seeding
 *   --state "<name>"     Seed one state only (case-insensitive)
 *
 * The seeder is fully idempotent – rerunning is safe (uses MERGE).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initializeNeo4j, closeNeo4j } from '../src/db/neo4j.config';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.DATA_GOV_IN_API_KEY ?? '';
const RESOURCE_ID = process.env.LGD_GP_RESOURCE_ID ?? '';
const BATCH_SIZE = 500; // Neo4j UNWIND batch
const FETCH_LIMIT = 1000; // data.gov.in page size

// ─── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const CLEAR_FIRST = args.includes('--clear');
// Raw: sent to API (case-sensitive); Lower: used for client-side comparison
const STATE_FILTER_RAW = (() => {
  const idx = args.indexOf('--state');
  return idx !== -1 ? (args[idx + 1] ?? '') : '';
})();
const STATE_FILTER = STATE_FILTER_RAW.toLowerCase();

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawRecord {
  stateCode: number | string;
  stateNameEnglish: string;
  districtCode: number | string;
  districtNameEnglish: string;
  subdistrictCode: number | string;
  subdistrictNameEnglish: string;
  villageCode: number | string;
  villageNameEnglish: string;
  pincode: number | string;
  [key: string]: unknown;
}

interface GPRecord {
  lgd_code: string; // villageCode
  name: string; // villageNameEnglish (title-case)
  subdistrict: string; // subdistrictNameEnglish
  subdistrict_code: string;
  district: string;
  district_lgd_code: string;
  state: string;
  state_lgd_code: string;
  pincode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
}

function parseRow(row: RawRecord): GPRecord | null {
  const name = toTitleCase(str(row.villageNameEnglish));
  const district = toTitleCase(str(row.districtNameEnglish));
  const state = toTitleCase(str(row.stateNameEnglish));
  const lgdCode = str(row.villageCode);

  if (!lgdCode || !name || !district || !state) return null;

  return {
    lgd_code: lgdCode,
    name,
    subdistrict: toTitleCase(str(row.subdistrictNameEnglish)),
    subdistrict_code: str(row.subdistrictCode),
    district,
    district_lgd_code: str(row.districtCode),
    state,
    state_lgd_code: str(row.stateCode),
    pincode: str(row.pincode),
  };
}

// ─── data.gov.in API ─────────────────────────────────────────────────────────

async function fetchPage(offset: number): Promise<{ records: RawRecord[]; total: number }> {
  const url = new URL(`https://api.data.gov.in/resource/${RESOURCE_ID}`);
  url.searchParams.set('api-key', API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(FETCH_LIMIT));
  url.searchParams.set('offset', String(offset));

  // Server-side filter (reduces pages needed for single-state runs)
  if (STATE_FILTER_RAW) {
    url.searchParams.set('filters[stateNameEnglish]', STATE_FILTER_RAW);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`data.gov.in ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as any;
  const records: RawRecord[] = json.records ?? json.data ?? [];
  const total: number = Number(json.total ?? records.length);
  return { records, total };
}

// ─── Neo4j write ─────────────────────────────────────────────────────────────

async function insertBatch(
  connection: ReturnType<typeof initializeNeo4j>,
  batch: GPRecord[]
): Promise<void> {
  await connection.executeWrite(
    `UNWIND $batch AS v
     MERGE (g:GramPanchayat { lgd_code: v.lgd_code })
     SET g.name             = v.name,
         g.subdistrict      = v.subdistrict,
         g.subdistrict_code = v.subdistrict_code,
         g.district         = v.district,
         g.district_lgd_code = v.district_lgd_code,
         g.state            = v.state,
         g.state_lgd_code   = v.state_lgd_code,
         g.pincode          = v.pincode`,
    { batch }
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(64));
  console.log('  LGD Village / GP Seeder  →  Neo4j');
  console.log('='.repeat(64));

  if (!API_KEY) {
    console.error('\n✗ DATA_GOV_IN_API_KEY not set in backend/.env');
    process.exit(1);
  }
  if (!RESOURCE_ID) {
    console.error('\n✗ LGD_GP_RESOURCE_ID not set in backend/.env');
    process.exit(1);
  }
  for (const v of ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD']) {
    if (!process.env[v]) {
      console.error(`\n✗ ${v} not set`);
      process.exit(1);
    }
  }

  console.log(`\n  Resource     : ${RESOURCE_ID}`);
  if (STATE_FILTER_RAW) console.log(`  State filter : ${STATE_FILTER_RAW}`);
  console.log(`  Clear first  : ${CLEAR_FIRST}`);

  const connection = initializeNeo4j({
    uri: process.env.NEO4J_URI!,
    username: process.env.NEO4J_USERNAME!,
    password: process.env.NEO4J_PASSWORD!,
    database: process.env.NEO4J_DATABASE || 'neo4j',
  });
  await connection.connect();
  console.log('\n✓ Connected to Neo4j');

  try {
    // Ensure constraint + index exist
    await connection.executeWrite(
      'CREATE CONSTRAINT gram_panchayat_lgd_code_unique IF NOT EXISTS FOR (g:GramPanchayat) REQUIRE g.lgd_code IS UNIQUE'
    );
    await connection.executeWrite(
      'CREATE INDEX gram_panchayat_location_index IF NOT EXISTS FOR (g:GramPanchayat) ON (g.state, g.district)'
    );

    if (CLEAR_FIRST) {
      if (STATE_FILTER) {
        console.log(`\nClearing GramPanchayat nodes for "${STATE_FILTER_RAW}"…`);
        await connection.executeWrite(
          'MATCH (g:GramPanchayat) WHERE toLower(g.state) = $s DETACH DELETE g',
          { s: STATE_FILTER }
        );
      } else {
        console.log('\nClearing ALL GramPanchayat nodes…');
        await connection.executeWrite('MATCH (g:GramPanchayat) DETACH DELETE g');
      }
      console.log('✓ Cleared');
    }

    // Probe first page
    console.log('\nFetching first page from data.gov.in…');
    const first = await fetchPage(0);
    console.log(`  Reported total : ${first.total.toLocaleString()}`);
    console.log(`  Page size      : ${first.records.length}`);

    if (first.records.length === 0) {
      console.warn('\n⚠  No records returned.');
      console.warn('  Sample response:', JSON.stringify(first).slice(0, 400));
      process.exit(1);
    }

    // Verify parsing works on first row
    const sample = parseRow(first.records[0] as RawRecord);
    if (!sample) {
      console.warn('\n⚠  Failed to parse first record.');
      console.warn('  Raw keys:', Object.keys(first.records[0]).join(', '));
      process.exit(1);
    }
    console.log('\n  Sample parsed record:');
    console.log(`    Village    : ${sample.name}`);
    console.log(`    Sub-dist   : ${sample.subdistrict}`);
    console.log(`    District   : ${sample.district}`);
    console.log(`    State      : ${sample.state}`);
    console.log(`    LGD code   : ${sample.lgd_code}`);
    console.log(`    PIN        : ${sample.pincode}`);

    // Stream all pages
    let offset = 0;
    let totalInserted = 0;
    let pending: GPRecord[] = [];

    const flush = async () => {
      if (pending.length === 0) return;
      await insertBatch(connection, pending);
      totalInserted += pending.length;
      pending = [];
    };

    const processPage = async (records: unknown[]) => {
      for (const raw of records) {
        const row = parseRow(raw as RawRecord);
        if (!row) continue;
        // Client-side state filter fallback
        if (STATE_FILTER && row.state.toLowerCase() !== STATE_FILTER) continue;
        pending.push(row);
        if (pending.length >= BATCH_SIZE) {
          await flush();
          process.stdout.write(`\r  Inserted: ${totalInserted.toLocaleString()}   `);
        }
      }
    };

    console.log('\nInserting…');
    await processPage(first.records);
    offset += FETCH_LIMIT;

    while (true) {
      const page = await fetchPage(offset);
      if (page.records.length === 0) break;
      await processPage(page.records);
      offset += FETCH_LIMIT;
      if (page.records.length < FETCH_LIMIT) break; // last page
    }

    await flush();

    console.log(`\n\n✓ Done — ${totalInserted.toLocaleString()} village/GP nodes upserted.`);
  } finally {
    await closeNeo4j();
  }
}

main().catch((err) => {
  console.error('\n✗ Fatal:', err?.message ?? err);
  process.exit(1);
});
