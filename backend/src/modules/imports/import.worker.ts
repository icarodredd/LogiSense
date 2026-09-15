import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { WebSocketGateway } from '../../websocket/websocket.gateway.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit-action.js';
import pkg from '@prisma/client';
import type { ImportType as PrismaImportType } from '@prisma/client';
import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';
import { createReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AuditContext } from '../audit/audit.service.js';

const { ImportStatus, ImportType } = pkg;

type Row = Record<string, string>;

const BATCH_SIZE = 100;

export interface RowResult {
  valid: number;
  skipped: number;
}

@Injectable()
export class ImportWorker {
  constructor(
    @Inject(WebSocketGateway) private readonly ws: WebSocketGateway,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async process(
    importId: string,
    tenantId: string,
    filePath: string,
    mimeType: string,
    type: PrismaImportType,
    auditCtx: AuditContext,
    userId?: string,
  ) {
    const imp = await this.prisma.import.findFirst({
      where: { id: importId, tenantId },
    });
    if (!imp) return;

    if (type === ImportType.SIMULATIONS) {
      await this.fail(
        imp,
        tenantId,
        userId,
        auditCtx,
        'Import do tipo SIMULATIONS ainda não suportado.',
      );
      return;
    }

    let totalRows = 0;
    try {
      this.ws.emitImportProgress(importId, {
        status: 'PROCESSING',
        processed: 0,
        total: 0,
        percentage: 0,
      });

      const rows = await this.parseFile(filePath, mimeType);
      totalRows = rows.length;

      await this.prisma.import.updateMany({
        where: { id: importId, tenantId },
        data: { status: ImportStatus.PROCESSING, totalRows },
      });

      const result: RowResult = { valid: 0, skipped: 0 };
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          const ok =
            type === ImportType.CUSTOMERS
              ? await this.processCustomerRow(tenantId, row)
              : await this.processCarrierRow(tenantId, row);
          if (ok) result.valid += 1;
          else result.skipped += 1;
        }

        const processed = Math.min(i + BATCH_SIZE, rows.length);
        const percentage =
          totalRows > 0 ? Math.round((processed / totalRows) * 100) : 100;

        await this.prisma.import.updateMany({
          where: { id: importId, tenantId },
          data: { processedRows: processed },
        });

        this.ws.emitImportProgress(importId, {
          status: 'PROCESSING',
          processed,
          total: totalRows,
          percentage,
        });
      }

      await this.prisma.import.updateMany({
        where: { id: importId, tenantId },
        data: {
          status: ImportStatus.COMPLETED,
          processedRows: totalRows,
          completedAt: new Date(),
        },
      });

      await this.audit.log({
        ...auditCtx,
        tenantId,
        userId,
        action: AuditAction.IMPORT_COMPLETED,
        entity: 'Import',
        entityId: importId,
        metadata: { filename: imp.filename, type, totalRows, ...result },
      });

      this.ws.emitImportProgress(importId, {
        status: 'COMPLETED',
        processed: totalRows,
        total: totalRows,
        percentage: 100,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.fail(imp, tenantId, userId, auditCtx, message);
    } finally {
      await this.cleanupFile(filePath);
    }
  }

  async handleQueueFailure(
    jobData: {
      importId: string;
      tenantId: string;
      userId?: string;
      filename: string;
      type: string;
      auditCtx?: Pick<AuditContext, 'ip' | 'userAgent' | 'requestId'>;
    },
    error: Error,
  ) {
    const message = error instanceof Error ? error.message : String(error);
    const existing = await this.prisma.import.findFirst({
      where: { id: jobData.importId, tenantId: jobData.tenantId },
      select: { id: true, status: true, filename: true },
    });
    if (!existing || existing.status === ImportStatus.COMPLETED) return;

    await this.prisma.import.updateMany({
      where: { id: jobData.importId, tenantId: jobData.tenantId },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    await this.audit.log({
      ip: jobData.auditCtx?.ip,
      userAgent: jobData.auditCtx?.userAgent,
      requestId: jobData.auditCtx?.requestId,
      tenantId: jobData.tenantId,
      userId: jobData.userId,
      action: AuditAction.IMPORT_FAILED,
      entity: 'Import',
      entityId: jobData.importId,
      metadata: {
        filename: jobData.filename,
        type: jobData.type,
        error: message,
      },
    });

    this.ws.emitImportProgress(jobData.importId, {
      status: 'FAILED',
      processed: 0,
      total: 0,
      percentage: 0,
      errorMessage: message,
    });
  }

  private async fail(
    imp: { id: string; filename: string },
    tenantId: string,
    userId: string | undefined,
    auditCtx: AuditContext,
    message: string,
  ) {
    await this.prisma.import.updateMany({
      where: { id: imp.id, tenantId },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    await this.audit.log({
      ...auditCtx,
      tenantId,
      userId,
      action: AuditAction.IMPORT_FAILED,
      entity: 'Import',
      entityId: imp.id,
      metadata: { filename: imp.filename, error: message },
    });

    this.ws.emitImportProgress(imp.id, {
      status: 'FAILED',
      processed: 0,
      total: 0,
      percentage: 0,
      errorMessage: message,
    });
  }

  private async processCustomerRow(
    tenantId: string,
    row: Row,
  ): Promise<boolean> {
    const name = (row.name ?? row.nome ?? '').trim();
    if (!name) return false;

    const document =
      (row.document ?? row.documento ?? '').replace(/\D/g, '') || null;
    const cep = (row.cep ?? '').replace(/\D/g, '') || null;
    const email = (row.email ?? '').trim() || null;
    const phone = (row.phone ?? row.telefone ?? '').trim() || null;
    const city = (row.city ?? row.cidade ?? '').trim() || null;
    const state = (row.state ?? row.uf ?? '').trim().toUpperCase() || null;

    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId,
        ...(document ? { document } : { name }),
      },
      select: { id: true },
    });

    const data = {
      name,
      ...(document ? { document } : {}),
      ...(cep ? { cep } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
    };

    if (existing) {
      await this.prisma.customer.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.customer.create({ data: { ...data, tenantId } });
    }
    return true;
  }

  private async processCarrierRow(
    tenantId: string,
    row: Row,
  ): Promise<boolean> {
    const name = (row.name ?? row.nome ?? '').trim();
    if (!name) return false;

    const toNumber = (value: string | undefined): number | null => {
      if (!value) return null;
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    };

    const baseFee = toNumber(row.baseFee ?? row.taxaBase);
    const pricePerKg = toNumber(row.pricePerKg ?? row.precoPorKg);
    const pricePerKm = toNumber(row.pricePerKm ?? row.precoPorKm);
    const riskPercent = toNumber(row.riskPercent ?? row.percentualRisco);
    const cubingFactorRaw = toNumber(row.cubingFactor ?? row.fatorCubagem);
    const document =
      (row.document ?? row.documento ?? '').replace(/\D/g, '') || null;
    const email = (row.email ?? '').trim() || null;
    const phone = (row.phone ?? row.telefone ?? '').trim() || null;

    const existing = await this.prisma.carrier.findFirst({
      where: { tenantId, name },
      select: { id: true },
    });

    const data: {
      name: string;
      document?: string;
      email?: string;
      phone?: string;
      baseFee?: number;
      pricePerKg?: number;
      pricePerKm?: number;
      riskPercent?: number;
      cubingFactor?: number;
    } = { name };

    if (document) data.document = document;
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (baseFee !== null) data.baseFee = baseFee;
    if (pricePerKg !== null) data.pricePerKg = pricePerKg;
    if (pricePerKm !== null) data.pricePerKm = pricePerKm;
    if (riskPercent !== null) data.riskPercent = riskPercent;
    if (cubingFactorRaw !== null)
      data.cubingFactor = Math.round(cubingFactorRaw);

    if (existing) {
      await this.prisma.carrier.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.carrier.create({
        data: {
          ...data,
          tenantId,
          baseFee: data.baseFee ?? 0,
          pricePerKg: data.pricePerKg ?? 0,
          pricePerKm: data.pricePerKm ?? 0,
          riskPercent: data.riskPercent ?? 0,
        },
      });
    }
    return true;
  }

  private async parseFile(filePath: string, mimeType: string): Promise<Row[]> {
    if (filePath.endsWith('.csv')) return this.parseCsv(filePath);
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      filePath.endsWith('.xlsx')
    ) {
      return this.parseXlsx(filePath);
    }
    throw new Error(`Tipo de arquivo não suportado: ${mimeType}`);
  }

  private parseCsv(filePath: string): Promise<Row[]> {
    return new Promise((resolve, reject) => {
      const rows: Row[] = [];
      const stream = createReadStream(filePath, { encoding: 'utf-8' });
      stream.on('error', reject);
      stream
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row: Row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  private async parseXlsx(filePath: string): Promise<Row[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const rows: Row[] = [];
    const headers: string[] = [];
    sheet.eachRow((row, rowNumber) => {
      const values = Array.from({ length: sheet.columnCount }, (_, i) => {
        const cell = row.getCell(i + 1);
        const text = cell?.text ?? '';
        return text.trim();
      });
      if (rowNumber === 1) {
        values.forEach((header) => headers.push(header));
        return;
      }
      const record: Row = {};
      headers.forEach((header, index) => {
        if (header) record[header] = values[index] ?? '';
      });
      rows.push(record);
    });
    return rows;
  }

  private async cleanupFile(filePath: string) {
    try {
      await mkdir(dirname(filePath), { recursive: true }).then(() => undefined);
      await unlink(filePath);
    } catch {
      // arquivo pode não existir (ex: upload falhou antes de gravar)
    }
  }
}
