// 도로교통공단 frequentzone 조회 + 정규화 + 메모리 캐시
import {
    AccidentZoneType,
    KOROAD_PATH,
    SEARCH_YEAR_CDS,
  } from "../config/koroad";
  
  export type AccidentZoneDto = {
    id: string;
    type: AccidentZoneType;
    name: string;
    yearCd: string;
    lat: number | null;
    lng: number | null;
    occrrnc_cnt: number | null;
    caslt_cnt: number | null;
    dth_dnv_cnt: number | null;
    path: Array<{ lat: number; lng: number }>;
  };
  
  const PAGE_SIZE = 100;
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10분
  
  const cache = new Map<
    string,
    { expires: number; data: AccidentZoneDto[] }
  >();
  
  function num(v: unknown): number | null {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  
  function getBaseUrl(): string {
    return (
      process.env.KOROAD_BASE_URL?.replace(/\/$/, "") ||
      "https://opendata.koroad.or.kr/data/rest/frequentzone"
    );
  }
  
  function getAuthKey(): string {
    const key = process.env.KOROAD_AUTH_KEY?.trim();
    if (!key) throw new Error("KOROAD_AUTH_KEY is not set");
    return key;
  }
  
  /** GeoJSON Polygon 문자열 → Kakao용 path */
  export function parseGeomPath(
    geomJson: unknown
  ): Array<{ lat: number; lng: number }> {
    if (geomJson == null || geomJson === "") return [];
    try {
      const g =
        typeof geomJson === "string" ? JSON.parse(geomJson) : geomJson;
      const ring = g?.coordinates?.[0];
      if (!Array.isArray(ring)) return [];
      return ring
        .map((p: unknown) => {
          if (!Array.isArray(p) || p.length < 2) return null;
          const lng = Number(p[0]);
          const lat = Number(p[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        })
        .filter((x): x is { lat: number; lng: number } => x != null);
    } catch {
      return [];
    }
  }
  
  function normalize(
    it: Record<string, unknown>,
    type: AccidentZoneType,
    yearCd: string
  ): AccidentZoneDto {
    // afos_id 는 데이터셋 코드라 다발지점마다 동일할 수 있음 → afos_fid / spot_cd 사용
    const unique = String(
      it.afos_fid ?? it.spot_cd ?? it.afos_id ?? it.spot_nm ?? ""
    );
    return {
      id: `${type}:${yearCd}:${unique}`,
      type,
      name: String(it.spot_nm ?? ""),
      yearCd,
      lat: num(it.la_crd),
      lng: num(it.lo_crd),
      occrrnc_cnt: num(it.occrrnc_cnt),
      caslt_cnt: num(it.caslt_cnt),
      dth_dnv_cnt: num(it.dth_dnv_cnt),
      path: parseGeomPath(it.geom_json ?? it.geomJson),
    };
  }
  
  /** 공단 응답 파서 — 실제 한 번 응답 찍어 필요 시 조정 */
  function extractItemsAndTotal(json: unknown): {
    items: Record<string, unknown>[];
    totalCount: number;
  } {
    const root = json as Record<string, unknown>;
    const response = (root?.response ?? root) as Record<string, unknown>;
    const body = (response?.body ??
      response?.searchResult ??
      response) as Record<string, unknown>;
  
    const itemsNode = body?.items ?? body?.resultData ?? body?.item;
    let raw: unknown = itemsNode;
    if (
      itemsNode &&
      typeof itemsNode === "object" &&
      !Array.isArray(itemsNode) &&
      "item" in (itemsNode as object)
    ) {
      raw = (itemsNode as { item: unknown }).item;
    }
  
    const items = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : raw && typeof raw === "object"
        ? [raw as Record<string, unknown>]
        : [];
  
    const totalCount =
      Number(body?.totalCount ?? body?.total_count ?? items.length) ||
      items.length;
  
    return { items, totalCount };
  }
  
  async function fetchPage(params: {
    path: string;
    searchYearCd: string;
    siDo: string;
    guGun: string;
    pageNo: number;
  }): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
    const qs = new URLSearchParams({
        searchYearCd: params.searchYearCd,
        siDo: params.siDo,
        guGun: params.guGun,
        type: "json",
        numOfRows: String(PAGE_SIZE),
        pageNo: String(params.pageNo),
      });
    
      // authKey: .env에 이미 인코딩된 값이면 그대로 붙임 (URLSearchParams에 넣지 말 것)
      const url = `${getBaseUrl()}/${params.path}?authKey=${getAuthKey()}&${qs.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`koroad HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    return extractItemsAndTotal(json);
  }
  
  async function fetchAllForYear(params: {
    path: string;
    searchYearCd: string;
    siDo: string;
    guGun: string;
  }): Promise<Record<string, unknown>[]> {
    const first = await fetchPage({ ...params, pageNo: 1 });
    const all = [...first.items];
    const pages = Math.max(1, Math.ceil(first.totalCount / PAGE_SIZE));
    for (let p = 2; p <= pages; p++) {
      const next = await fetchPage({ ...params, pageNo: p });
      all.push(...next.items);
    }
    return all;
  }
  
  async function fetchByType(
    type: AccidentZoneType,
    siDo: string,
    guGun: string
  ): Promise<AccidentZoneDto[]> {
    const path = KOROAD_PATH[type];
    const yearCds = SEARCH_YEAR_CDS[type];

    const batches = await Promise.allSettled(
      yearCds.map(async (searchYearCd) => {
        const raw = await fetchAllForYear({
          path,
          searchYearCd,
          siDo,
          guGun,
        });
        return raw.map((it) => normalize(it, type, searchYearCd));
      })
    );

    const rows: AccidentZoneDto[] = [];
    let anyOk = false;
    batches.forEach((result, i) => {
      if (result.status === "fulfilled") {
        anyOk = true;
        rows.push(...result.value);
        return;
      }
      console.error(
        `[koroad] type=${type} yearCd=${yearCds[i]} failed`,
        result.reason
      );
    });

    if (!anyOk) {
      throw new Error(`koroad ${type} all yearCd failed`);
    }

    const map = new Map<string, AccidentZoneDto>();
    for (const row of rows) {
      if (row.path.length < 3) continue;
      map.set(row.id, row);
    }
    return [...map.values()];
  }
  
  function cacheKey(type: AccidentZoneType, siDo: string, guGun: string) {
    return `${type}|${siDo}|${guGun}`;
  }
  
  export async function getAccidentZones(
    type: AccidentZoneType,
    siDo: string,
    guGun: string
  ): Promise<AccidentZoneDto[]> {
    const key = cacheKey(type, siDo, guGun);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.data;
  
    const data = await fetchByType(type, siDo, guGun);
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
    return data;
  }