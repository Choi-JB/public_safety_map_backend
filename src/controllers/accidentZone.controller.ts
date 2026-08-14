// GET /accident-zones — 다발지역 프록시
import { Request, Response } from "express";
import {
  ALL_ACCIDENT_ZONE_TYPES,
  AccidentZoneType,
  isAccidentZoneType,
} from "../config/koroad";
import { getAccidentZones } from "../utils/koroadAccident.service";

/**
 * GET /accident-zones?type=pedestrian|bicycle|motorcycle|schoolzone&siDo=&guGun=
 * type 생략 시 4종 전부
 */
export const listAccidentZones = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!process.env.KOROAD_AUTH_KEY?.trim()) {
      res.status(503).json({
        success: false,
        message: "KOROAD_AUTH_KEY is not configured",
      });
      return;
    }

    const siDo = String(req.query.siDo ?? "").trim();
    const guGun = String(req.query.guGun ?? "").trim();

    if (!siDo || !guGun) {
      res.status(422).json({
        success: false,
        message: "siDo, guGun are required",
      });
      return;
    }

    // 간단 형식 체크 (서울 11, 구 3자리 등)
    if (!/^\d{2}$/.test(siDo) || !/^\d{1,3}$/.test(guGun)) {
      res.status(422).json({
        success: false,
        message: "siDo must be 2 digits, guGun must be 1-3 digits",
      });
      return;
    }

    const typeRaw =
      req.query.type !== undefined && req.query.type !== ""
        ? String(req.query.type)
        : null;

    let types: AccidentZoneType[];

    if (typeRaw) {
      if (!isAccidentZoneType(typeRaw)) {
        res.status(422).json({
          success: false,
          message:
            "type must be one of pedestrian|bicycle|motorcycle|schoolzone",
        });
        return;
      }
      types = [typeRaw]; // 여기서 typeRaw → AccidentZoneType
    } else {
      types = ALL_ACCIDENT_ZONE_TYPES;
    }

    const nested = await Promise.allSettled(
      types.map((t) => getAccidentZones(t, siDo, guGun))
    );

    const okTypes: AccidentZoneType[] = [];
    const items = nested.flatMap((result, i) => {
      const type = types[i];
      if (result.status === "fulfilled") {
        okTypes.push(type);
        return result.value;
      }
      console.error(`[accident-zones] type=${type} failed`, result.reason);
      return [];
    });

    if (okTypes.length === 0) {
      res.status(502).json({
        success: false,
        message: "failed to fetch koroad frequentzone",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        siDo,
        guGun,
        types: okTypes,
        count: items.length,
        items,
      },
    });
  } catch (err) {
    console.error("[accident-zones]", err);
    res.status(502).json({
      success: false,
      message: "failed to fetch koroad frequentzone",
    });
  }
};