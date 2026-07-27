// 작업자 : 최정봉
// 설명 : 공통 유틸리티 함수
import prismaClient from '../config/prismaClient';
import crypto from "crypto";

type TypeSource = 'report' | 'city_events';

/** 유저가 등록한 제보, 도시 행사의 타입 종류 가져오기 */
export async function getTypes(source: TypeSource): Promise<(string | null)[]> {
    try {
        if (source === "report") {
            const groups = await prismaClient.report.groupBy({ by: ["type"] });
            return groups.map((g) => g.type);
        }
        const groups = await prismaClient.city_events.groupBy({ by: ["type"] });
        return groups.map((g) => g.type);
    } catch (error) {
        console.error(`Error getting types for ${source}:`, error);
        return [];
    }
}


/** 랜덤 refresh token 원본 생성 (64바이트 → 128자 hex 문자열) */
export function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString("hex");
}

/** refresh token을 SHA-256으로 해시 (DB 저장용, 원본은 저장하지 않음) */
export function hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}