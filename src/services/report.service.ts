import type { Report, Prisma } from '@prisma/client';
import prisma from '../config/prismaClient.js';
import { resolveGridId } from '../utils/gridUtils.js';
import { saveResizedImage } from '../utils/imageUpload.js';
import { AppError } from '../utils/errors.js';
import type { AuthUser } from '../middlewares/auth.middleware.js';

function toResponse(row: Report) {
  return {
    id: Number(row.id),
    userId: row.userId != null ? Number(row.userId) : null,
    gridId: row.gridId != null ? Number(row.gridId) : null,
    type: row.type,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    description: row.description,
    imgUrl: row.imgUrl,
    isActive: row.isActive,
    createdAt: row.createdAt,
    expireAt: row.expireAt,
  };
}

function parseBool(v: unknown, defaultValue: boolean): boolean {
  if (v === undefined || v === null || v === '') return defaultValue;
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return defaultValue;
}

export async function listReports(query: Record<string, unknown>) {
  const activeOnly = parseBool(query.activeOnly, true);
  const includeExpired = parseBool(query.includeExpired, false);
  const { swLat, swLng, neLat, neLng } = query;

  const where: Prisma.ReportWhereInput = {};
  if (activeOnly) where.isActive = 'Y';
  if (!includeExpired) {
    where.OR = [{ expireAt: null }, { expireAt: { gt: new Date() } }];
  }

  const hasBBox =
    swLat !== undefined &&
    swLng !== undefined &&
    neLat !== undefined &&
    neLng !== undefined &&
    swLat !== '' &&
    swLng !== '' &&
    neLat !== '' &&
    neLng !== '';

  if (hasBBox) {
    where.lat = { gte: Number(swLat), lte: Number(neLat) };
    where.lng = { gte: Number(swLng), lte: Number(neLng) };
  }

  const rows = await prisma.report.findMany({ where, orderBy: { id: 'desc' } });
  return { items: rows.map(toResponse) };
}

function validateCreateBody(body: Record<string, unknown>) {
  const { type, lat, lng, description } = body;
  if (!type || lat === undefined || lng === undefined || !description) {
    throw new AppError(400, 'VALIDATION_ERROR', 'type, lat, lng, description are required');
  }
  if (String(type).length > 50) {
    throw new AppError(400, 'VALIDATION_ERROR', 'type maxLength 50');
  }
  if (String(description).length > 5000) {
    throw new AppError(400, 'VALIDATION_ERROR', 'description maxLength 5000');
  }
}

export async function createReport(
  userId: number,
  body: Record<string, unknown>,
  file?: Express.Multer.File
) {
  validateCreateBody(body);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'lat/lng must be numbers');
  }

  let gridIdNum: number | null =
    body.gridId != null && body.gridId !== '' ? Number(body.gridId) : null;
  if (gridIdNum == null || Number.isNaN(gridIdNum)) {
    const resolved = await resolveGridId(lat, lng);
    gridIdNum = resolved != null ? Number(resolved) : null;
  }
  const gridId = gridIdNum != null ? BigInt(gridIdNum) : null;

  const imgUrl = await saveResizedImage(file);
  const now = new Date();
  const expireAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const row = await prisma.report.create({
    data: {
      userId: BigInt(userId),
      gridId,
      type: String(body.type),
      lat,
      lng,
      description: String(body.description),
      imgUrl,
      isActive: 'Y',
      createdAt: now,
      expireAt,
    },
  });

  return toResponse(row);
}

export async function updateReport(
  id: string | number,
  user: AuthUser,
  body: Record<string, unknown>,
  file?: Express.Multer.File
) {
  const row = await prisma.report.findUnique({ where: { id: BigInt(id) } });
  if (!row || row.isActive === 'N') {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  }
  if (Number(row.userId) !== Number(user.id)) {
    throw new AppError(403, 'FORBIDDEN', 'Only owner can update');
  }

  const data: Prisma.ReportUpdateInput = {};

  if (body.type !== undefined) {
    if (String(body.type).length > 50) {
      throw new AppError(400, 'VALIDATION_ERROR', 'type maxLength 50');
    }
    data.type = String(body.type);
  }
  if (body.description !== undefined) {
    if (!body.description || String(body.description).length > 5000) {
      throw new AppError(400, 'VALIDATION_ERROR', 'description invalid');
    }
    data.description = String(body.description);
  }

  let lat = row.lat != null ? Number(row.lat) : null;
  let lng = row.lng != null ? Number(row.lng) : null;
  let coordsChanged = false;
  if (body.lat !== undefined) {
    lat = Number(body.lat);
    coordsChanged = true;
  }
  if (body.lng !== undefined) {
    lng = Number(body.lng);
    coordsChanged = true;
  }
  if (coordsChanged) {
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'lat/lng must be numbers');
    }
    data.lat = lat;
    data.lng = lng;
    const gridId = await resolveGridId(lat, lng);
    data.grid = gridId != null ? { connect: { id: gridId } } : { disconnect: true };
  }

  if (file) {
    data.imgUrl = await saveResizedImage(file);
  }

  const updated = await prisma.report.update({ where: { id: row.id }, data });
  return toResponse(updated);
}

export async function deleteReport(id: string | number, user: AuthUser) {
  const row = await prisma.report.findUnique({ where: { id: BigInt(id) } });
  if (!row || row.isActive === 'N') {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  }
  const isOwner = Number(row.userId) === Number(user.id);
  const isAdmin = user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Only owner or admin can delete');
  }
  await prisma.report.update({ where: { id: row.id }, data: { isActive: 'N' } });
}
