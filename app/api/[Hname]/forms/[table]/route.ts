import { NextResponse } from "next/server";
import {
  columnNameFromFieldId,
  ensureSafeIdentifier,
  quoteIdentifier,
  tableNameFromCardTitle,
} from "../../../../../lib/master-form-table";
import { getTenantDB } from "../../../../../lib/db";
import type { Pool } from "pg";

export const runtime = "nodejs";

type ApiField = {
  id: string;
  type:
    | "text"
    | "number"
    | "select"
    | "multiselect"
    | "checkbox"
    | "display"
    | "datetime-local"
    | "date"
    | "time"
    | "textarea";
};

type PostBody = {
  cardTitle?: string;
  fields?: ApiField[];
  values?: Record<string, unknown>;
};

type PutBody = PostBody & {
  id?: number;
};

type DeleteBody = {
  id?: number;
};

const DEFAULT_PATIENT_TYPE = "Walk in";

function resolveTableName(routeTable: string, cardTitle?: string) {
  const safeRouteTable = ensureSafeIdentifier(routeTable, "table");

  if (!cardTitle) {
    return safeRouteTable;
  }

  const derivedTable = tableNameFromCardTitle(cardTitle);

  if (derivedTable !== safeRouteTable) {
    throw new Error("Table name does not match card title.");
  }

  return safeRouteTable;
}

function getColumnType(field: ApiField["type"]) {
  switch (field) {
    case "number":
      return "NUMERIC";
    case "date":
      return "DATE";
    case "time":
      return "TIME";
    case "datetime-local":
      return "TIMESTAMP";
    case "multiselect":
    case "checkbox":
      return "JSONB";
    default:
      return "TEXT";
  }
}

function normalizeValue(field: ApiField, rawValue: unknown) {
  if (field.type === "multiselect" || field.type === "checkbox") {
    const values = Array.isArray(rawValue)
      ? rawValue.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];

    return values.length > 0 ? JSON.stringify(values) : null;
  }

  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (field.type === "number") {
    return Number(trimmed);
  }

  return trimmed;
}

async function ensureTable(pool: Pool, tableName: string, fields: ApiField[]) {
  const quotedTable = quoteIdentifier(tableName);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quotedTable} (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existingColumnsResult = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName],
  );

  const existingColumns = new Set(
    existingColumnsResult.rows.map(
      (row: { column_name: string }) => row.column_name,
    ),
  );

  for (const field of fields) {
    const columnName = columnNameFromFieldId(field.id);

    if (existingColumns.has(columnName)) {
      continue;
    }

    await pool.query(
      `ALTER TABLE ${quotedTable} ADD COLUMN ${quoteIdentifier(columnName)} ${getColumnType(field.type)}`,
    );
  }
}

async function tableExists(pool: Pool, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );

  return result.rows[0]?.exists ?? false;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string; table: string }> },
) {
  try {
    const { Hname, table } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    const { searchParams } = new URL(request.url);
    const recordId = Number(searchParams.get("id") ?? 0);
    
    const tableName = ensureSafeIdentifier(table, "table");

    if (!(await tableExists(pool, tableName))) {
      return NextResponse.json({ rows: [] });
    }

    if (Number.isInteger(recordId) && recordId > 0) {
      const rowResult = await pool.query(
        `SELECT * FROM ${quoteIdentifier(tableName)} WHERE id = $1 LIMIT 1`,
        [recordId],
      );

      return NextResponse.json({ rows: rowResult.rows });
    }

    const rowsResult = await pool.query(
      `SELECT * FROM ${quoteIdentifier(tableName)} ORDER BY id DESC LIMIT 50`,
    );

    return NextResponse.json({ rows: rowsResult.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch records.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string; table: string }> },
) {
  try {
    const { Hname, table } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    
    const body = (await request.json()) as PostBody;
    const fields = body.fields ?? [];
    const values = { ...(body.values ?? {}) };

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields were provided for this form." },
        { status: 400 },
      );
    }

    const tableName = resolveTableName(table, body.cardTitle);

    if (
      tableName === "patient_registration" &&
      fields.some((field) => field.id === "patientType")
    ) {
      const patientTypeValue = values.patientType;
      if (typeof patientTypeValue !== "string" || patientTypeValue.trim().length === 0) {
        values.patientType = DEFAULT_PATIENT_TYPE;
      }
    }

    await ensureTable(pool, tableName, fields);

    const insertableFields = fields.filter((field) =>
      Object.prototype.hasOwnProperty.call(values, field.id),
    );

    if (insertableFields.length === 0) {
      return NextResponse.json(
        { error: "No form values were provided." },
        { status: 400 },
      );
    }

    const columns = insertableFields.map((field) =>
      quoteIdentifier(columnNameFromFieldId(field.id)),
    );
    const placeholders = insertableFields.map((_, index) => `$${index + 1}`);
    const insertValues = insertableFields.map((field) =>
      normalizeValue(field, values[field.id]),
    );

    const insertResult = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(tableName)} (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING *
      `,
      insertValues,
    );

    return NextResponse.json({
      row: insertResult.rows[0],
      tableName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save form values.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string; table: string }> },
) {
  try {
    const { Hname, table } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);

    const body = (await request.json()) as PutBody;
    const fields = body.fields ?? [];
    const values = body.values ?? {};
    const id = body.id;

    if (!Number.isInteger(id) || Number(id) <= 0) {
      return NextResponse.json({ error: "A valid record id is required." }, { status: 400 });
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields were provided for this form." },
        { status: 400 },
      );
    }

    const tableName = resolveTableName(table, body.cardTitle);

    if (!(await tableExists(pool, tableName))) {
      return NextResponse.json({ error: "Table does not exist." }, { status: 404 });
    }

    await ensureTable(pool, tableName, fields);

    const updatableFields = fields.filter((field) =>
      Object.prototype.hasOwnProperty.call(values, field.id),
    );

    if (updatableFields.length === 0) {
      return NextResponse.json(
        { error: "No form values were provided." },
        { status: 400 },
      );
    }

    const assignments = updatableFields.map(
      (field, index) =>
        `${quoteIdentifier(columnNameFromFieldId(field.id))} = $${index + 1}`,
    );
    const updateValues = updatableFields.map((field) =>
      normalizeValue(field, values[field.id]),
    );

    const updateResult = await pool.query(
      `
        UPDATE ${quoteIdentifier(tableName)}
        SET ${assignments.join(", ")}, updated_at = NOW()
        WHERE id = $${updatableFields.length + 1}
        RETURNING *
      `,
      [...updateValues, id],
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json({
      row: updateResult.rows[0],
      tableName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update form values.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ Hname: string; table: string }> },
) {
  try {
    const { Hname, table } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    const body = (await request.json()) as DeleteBody;
    const id = body.id;
    const tableName = ensureSafeIdentifier(table, "table");

    if (!Number.isInteger(id) || Number(id) <= 0) {
      return NextResponse.json({ error: "A valid record id is required." }, { status: 400 });
    }

    if (!(await tableExists(pool, tableName))) {
      return NextResponse.json({ error: "Table does not exist." }, { status: 404 });
    }

    const deleteResult = await pool.query(
      `DELETE FROM ${quoteIdentifier(tableName)} WHERE id = $1 RETURNING id`,
      [id],
    );

    if (deleteResult.rowCount === 0) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete form values.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
