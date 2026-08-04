import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";
import {
  generateFloorName,
  generateRoomName,
  generateBedName,
  TABLE_NAMES,
} from "../../../../lib/infrastructure";
import type { Pool } from "pg";

export const runtime = "nodejs";

/* ─── Helpers ─── */

async function tableExists(pool: Pool, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return result.rows[0]?.exists ?? false;
}

async function ensureColumn(pool: Pool, tableName: string, columnName: string, columnType: string) {
  const colCheck = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [tableName, columnName]
  );
  if (!colCheck.rows[0]?.exists) {
    await pool.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(columnName)} ${columnType}`
    );
  }
}

/* ─── Ensure all infrastructure tables ─── */

async function ensureInfrastructureTables(pool: Pool) {
  // Building Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.BUILDING)} (
      id BIGSERIAL PRIMARY KEY,
      code TEXT,
      building_name TEXT,
      description TEXT,
      status TEXT DEFAULT 'Active',
      active_from TIMESTAMP,
      inactive_date_from TIMESTAMP,
      inactive_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Floor Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.FLOOR)} (
      id BIGSERIAL PRIMARY KEY,
      code TEXT,
      floor_name TEXT,
      floor_number NUMERIC,
      building TEXT,
      building_id BIGINT,
      active_from TIMESTAMP,
      inactive_date_from TIMESTAMP,
      inactive_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ensureColumn(pool, TABLE_NAMES.FLOOR, "building_id", "BIGINT");

  // Room Purpose Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.ROOM_PURPOSE)} (
      id BIGSERIAL PRIMARY KEY,
      code TEXT,
      description TEXT,
      active_from TIMESTAMP,
      inactive_date_from TIMESTAMP,
      inactive_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Floor-Department Assignment
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} (
      id BIGSERIAL PRIMARY KEY,
      floor_id BIGINT,
      floor_name TEXT,
      building_id BIGINT,
      building_name TEXT,
      department_id BIGINT,
      department_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Ward Instance
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} (
      id BIGSERIAL PRIMARY KEY,
      ward_type TEXT,
      floor_dept_assignment_id BIGINT,
      building_name TEXT,
      floor_name TEXT,
      department_name TEXT,
      status TEXT DEFAULT 'Active',
      active_from TIMESTAMP,
      inactive_date_from TIMESTAMP,
      inactive_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Room Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.ROOM)} (
      id BIGSERIAL PRIMARY KEY,
      code TEXT,
      description TEXT,
      room_type TEXT,
      room_purpose TEXT,
      rate NUMERIC DEFAULT 0,
      capacity NUMERIC DEFAULT 1,
      status TEXT DEFAULT 'Available',
      location TEXT,
      ward_instance_id BIGINT,
      building_name TEXT,
      floor_name TEXT,
      department_name TEXT,
      ward_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ensureColumn(pool, TABLE_NAMES.ROOM, "ward_instance_id", "BIGINT");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "room_purpose", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "capacity", "NUMERIC");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "status", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "building_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "floor_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "department_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.ROOM, "ward_name", "TEXT");

  // Bed Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.BED)} (
      id BIGSERIAL PRIMARY KEY,
      code TEXT,
      description TEXT,
      bed_number TEXT,
      bed_type TEXT DEFAULT 'Standard',
      rate NUMERIC DEFAULT 0,
      charge NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'Available',
      ward TEXT,
      room_id BIGINT,
      building_name TEXT,
      floor_name TEXT,
      department_name TEXT,
      ward_name TEXT,
      room_name TEXT,
      patient_id TEXT,
      patient_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ensureColumn(pool, TABLE_NAMES.BED, "room_id", "BIGINT");
  await ensureColumn(pool, TABLE_NAMES.BED, "bed_number", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "bed_type", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "status", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "charge", "NUMERIC");
  await ensureColumn(pool, TABLE_NAMES.BED, "patient_id", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "patient_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "building_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "floor_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "department_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "ward_name", "TEXT");
  await ensureColumn(pool, TABLE_NAMES.BED, "room_name", "TEXT");

  // Bed Allocation
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)} (
      id BIGSERIAL PRIMARY KEY,
      bed_id BIGINT,
      patient_id TEXT,
      patient_name TEXT,
      building_name TEXT,
      floor_name TEXT,
      department_name TEXT,
      ward_name TEXT,
      room_name TEXT,
      bed_name TEXT,
      allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      allocated_by_name TEXT,
      allocated_by_role TEXT,
      discharged_at TIMESTAMPTZ,
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Bed Transfer History
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)} (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      old_bed_id BIGINT,
      old_bed_name TEXT,
      old_room_name TEXT,
      old_ward_name TEXT,
      old_floor_name TEXT,
      old_building_name TEXT,
      new_bed_id BIGINT,
      new_bed_name TEXT,
      new_room_name TEXT,
      new_ward_name TEXT,
      new_floor_name TEXT,
      new_building_name TEXT,
      transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      transferred_by_name TEXT,
      transferred_by_role TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Bed Status Audit
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAMES.BED_STATUS_AUDIT)} (
      id BIGSERIAL PRIMARY KEY,
      bed_id BIGINT,
      bed_name TEXT,
      old_status TEXT,
      new_status TEXT,
      changed_by_name TEXT,
      changed_by_role TEXT,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // event_type on transfer history (Discharge vs Transfer)
  await ensureColumn(pool, TABLE_NAMES.BED_TRANSFER_HISTORY, "event_type", "TEXT DEFAULT 'Transfer'");

  // Bed Billing Lines — one row per rate period per patient-bed stay
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bed_billing_line (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      bed_id BIGINT,
      bed_name TEXT,
      room_id BIGINT,
      room_name TEXT,
      ward_name TEXT,
      floor_name TEXT,
      building_name TEXT,
      rate_per_day NUMERIC DEFAULT 0,
      start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at TIMESTAMPTZ,
      days_count NUMERIC,
      total_amount NUMERIC,
      admission_ref TEXT,
      status TEXT DEFAULT 'Open',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Housekeeping Tasks — created when a bed is vacated (transfer-out or discharge)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS housekeeping_task (
      id BIGSERIAL PRIMARY KEY,
      bed_id BIGINT,
      bed_name TEXT,
      room_id BIGINT,
      room_name TEXT,
      ward_name TEXT,
      floor_name TEXT,
      building_name TEXT,
      vacated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_to TEXT,
      status TEXT DEFAULT 'Pending',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      completed_by TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/* ─── Shared creation functions (used by both manual and bulk generator) ─── */

async function createBuilding(
  pool: Pool,
  data: { code?: string; buildingName: string; description?: string; status?: string }
) {
  const code = data.code || data.buildingName.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toUpperCase();
  const result = await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BUILDING)}
       (code, building_name, description, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [code, data.buildingName, data.description || "", data.status || "Active"]
  );
  return result.rows[0];
}

async function createFloor(
  pool: Pool,
  data: { buildingId: number; buildingName: string; floorNumber: number; floorName?: string }
) {
  const name = data.floorName || generateFloorName(data.floorNumber);
  const code = `F${data.floorNumber}`;
  const result = await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.FLOOR)}
       (code, floor_name, floor_number, building, building_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [code, name, data.floorNumber, data.buildingName, data.buildingId]
  );
  return result.rows[0];
}

async function createFloorDeptAssignment(
  pool: Pool,
  data: {
    floorId: number;
    floorName: string;
    buildingId: number;
    buildingName: string;
    departmentId: number;
    departmentName: string;
  }
) {
  const result = await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)}
       (floor_id, floor_name, building_id, building_name, department_id, department_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.floorId, data.floorName, data.buildingId, data.buildingName, data.departmentId, data.departmentName]
  );
  return result.rows[0];
}

async function createWardInstance(
  pool: Pool,
  data: {
    wardType: string;
    floorDeptAssignmentId: number;
    buildingName: string;
    floorName: string;
    departmentName: string;
  }
) {
  const result = await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)}
       (ward_type, floor_dept_assignment_id, building_name, floor_name, department_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.wardType, data.floorDeptAssignmentId, data.buildingName, data.floorName, data.departmentName]
  );
  return result.rows[0];
}

async function createRoom(
  pool: Pool,
  data: {
    wardInstanceId?: number | null;
    floorNumber: number;
    roomIndex: number;
    roomType?: string;
    roomPurpose?: string;
    capacity?: number;
    rate?: number;
    buildingName: string;
    floorName: string;
    departmentName: string;
    wardName?: string;
    description?: string;
  }
) {
  const roomName = data.description || generateRoomName(data.floorNumber, data.roomIndex);
  const code = roomName.replace(/\s+/g, "");
  const result = await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.ROOM)}
       (code, description, room_type, room_purpose, rate, capacity, status, location,
        ward_instance_id, building_name, floor_name, department_name, ward_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      code,
      roomName,
      data.roomType || "",
      data.roomPurpose || "Patient Room",
      data.rate || 0,
      data.capacity || 1,
      "Available",
      "",
      data.wardInstanceId,
      data.buildingName,
      data.floorName,
      data.departmentName,
      data.wardName,
    ]
  );
  return result.rows[0];
}

async function createBed(
  pool: Pool,
  data: {
    roomId: number;
    bedIndex: number;
    bedType?: string;
    charge?: number;
    buildingName: string;
    floorName: string;
    departmentName: string;
    wardName?: string;
    roomName: string;
    ward?: string;
    description?: string;
  }
) {
  const bedName = data.description || generateBedName(data.bedIndex);
  const code = data.description
    ? `${data.roomName.replace(/\s+/g, "")}-B${data.description.replace(/\s+/g, "")}`
    : `${data.roomName.replace(/\s+/g, "")}-B${data.bedIndex + 1}`;
  const result = await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED)}
       (code, description, bed_number, bed_type, rate, charge, status, ward,
        room_id, building_name, floor_name, department_name, ward_name, room_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      code,
      bedName,
      bedName,
      data.bedType || "Standard",
      data.charge || 0,
      data.charge || 0,
      "Available",
      data.ward || data.wardName,
      data.roomId,
      data.buildingName,
      data.floorName,
      data.departmentName,
      data.wardName,
      data.roomName,
    ]
  );
  return result.rows[0];
}

/* ─── Bed State Machine ─── */

/** Legal transition graph. Returns error string if transition is illegal, null if OK. */
function checkTransition(from: string, to: string): string | null {
  const graph: Record<string, string[]> = {
    Available: ["Occupied", "Reserved", "Maintenance"],
    Occupied: ["Cleaning"],
    Reserved: ["Occupied", "Available"],
    Cleaning: ["Available"],
    Maintenance: ["Available"],
    Blocked: ["Available", "Maintenance"],
  };
  const allowed = graph[from] ?? [];
  if (!allowed.includes(to)) {
    return `Illegal bed status transition: ${from} → ${to}. Allowed from ${from}: ${allowed.join(", ") || "none"}.`;
  }
  return null;
}

/** Enforce the state machine, update bed_master, and write audit row. */
async function transitionBedStatus(
  pool: Pool,
  bedId: number,
  newStatus: string,
  performedBy: string,
  reason?: string
) {
  const bedRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id = $1`, [bedId]);
  const bed = bedRes.rows[0];
  if (!bed) throw new Error(`Bed ${bedId} not found.`);
  const oldStatus = bed.status || "Available";

  const err = checkTransition(oldStatus, newStatus);
  if (err) throw new Error(err);

  await pool.query(
    `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)} SET status = $1, updated_at = NOW() WHERE id = $2`,
    [newStatus, bedId]
  );

  // If moving away from Occupied, clear patient linkage
  if (oldStatus === "Occupied" && newStatus !== "Occupied") {
    await pool.query(
      `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)} SET patient_id = NULL, patient_name = NULL, updated_at = NOW() WHERE id = $1`,
      [bedId]
    );
  }

  await pool.query(
    `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_STATUS_AUDIT)}
       (bed_id, bed_name, old_status, new_status, changed_by_name, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [bedId, bed.description || bed.bed_number, oldStatus, newStatus, performedBy, reason || null]
  );

  return bed; // return bed record before modification
}

/** Called on transfer-out or discharge: sets bed → Cleaning, creates a housekeeping task. */
async function vacateBed(pool: Pool, bed: Record<string, unknown>, performedBy: string, reason?: string) {
  await transitionBedStatus(pool, Number(bed.id), "Cleaning", performedBy, reason);

  await pool.query(
    `INSERT INTO housekeeping_task
       (bed_id, bed_name, room_id, room_name, ward_name, floor_name, building_name, vacated_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
    [
      bed.id, bed.description || bed.bed_number,
      bed.room_id, bed.room_name,
      bed.ward_name, bed.floor_name, bed.building_name,
      performedBy,
    ]
  );
}

/** Open a billing line when a bed is allocated or reservation converted. */
async function createBillingLine(
  pool: Pool,
  params: {
    patientId: string; patientName: string;
    bed: Record<string, unknown>;
    createdBy: string;
  }
) {
  const { patientId, patientName, bed, createdBy } = params;
  await pool.query(
    `INSERT INTO bed_billing_line
       (patient_id, patient_name, bed_id, bed_name, room_id, room_name,
        ward_name, floor_name, building_name, rate_per_day, start_at, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'Open', $11)`,
    [
      patientId, patientName,
      bed.id, bed.description || bed.bed_number,
      bed.room_id, bed.room_name,
      bed.ward_name, bed.floor_name, bed.building_name,
      bed.charge || bed.rate || 0,
      createdBy,
    ]
  );
}

/** Close a billing line (on transfer-out, discharge, or release). Returns amount. */
async function closeBillingLine(
  pool: Pool,
  bedId: number,
  patientId: string,
  admissionRef?: string
): Promise<number> {
  const res = await pool.query(
    `SELECT * FROM bed_billing_line WHERE bed_id = $1 AND patient_id = $2 AND status = 'Open' LIMIT 1`,
    [bedId, patientId]
  );
  const line = res.rows[0];
  if (!line) return 0;

  const startAt = new Date(line.start_at);
  const endAt = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysCount = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / msPerDay));
  const totalAmount = Number(line.rate_per_day) * daysCount;

  await pool.query(
    `UPDATE bed_billing_line
     SET end_at = NOW(), days_count = $1, total_amount = $2, status = 'Closed',
         admission_ref = $3, updated_at = NOW()
     WHERE id = $4`,
    [daysCount, totalAmount, admissionRef || null, line.id]
  );
  return totalAmount;
}

/** Read the logged-in username from the auth cookie (same key as actions/user.ts). */
async function getSessionUser(hname: string): Promise<string> {
  try {
    const cookieStore = await cookies();
    const key = `auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return cookieStore.get(key)?.value || "system";
  } catch {
    return "system";
  }
}

/* ─── GET: Fetch hierarchy data ─── */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureInfrastructureTables(pool);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "hierarchy";

    // Full hierarchy
    if (action === "hierarchy") {
      const buildingId = searchParams.get("buildingId");
      const floorId = searchParams.get("floorId");

      const buildings = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} ORDER BY id`
      );

      let floors;
      if (buildingId) {
        floors = await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.FLOOR)} WHERE building_id = $1 ORDER BY floor_number`,
          [buildingId]
        );
      } else {
        floors = await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.FLOOR)} ORDER BY building_id, floor_number`
        );
      }

      const floorDeptFilter = floorId ? `WHERE floor_id = $1` : "";
      const floorDeptParams = floorId ? [floorId] : [];
      const floorDepts = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} ${floorDeptFilter} ORDER BY id`,
        floorDeptParams
      );

      const wardInstances = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} ORDER BY id`
      );

      // Rooms and beds — filter if building/floor specified
      let roomFilter = "";
      const roomParams: string[] = [];
      if (buildingId) {
        const buildingRow = buildings.rows.find(
          (b: Record<string, unknown>) => String(b.id) === buildingId
        );
        if (buildingRow) {
          roomFilter = "WHERE LOWER(building_name) = LOWER($1)";
          roomParams.push(String(buildingRow.building_name ?? ""));
          if (floorId) {
            const floorRow = floors.rows.find(
              (f: Record<string, unknown>) => String(f.id) === floorId
            );
            if (floorRow) {
              roomFilter += " AND LOWER(floor_name) = LOWER($2)";
              roomParams.push(String(floorRow.floor_name ?? ""));
            }
          }
        }
      }

      const rooms = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} ${roomFilter} ORDER BY id`,
        roomParams
      );

      const beds = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} ${roomFilter ? roomFilter.replace("LOWER(building_name)", "LOWER(building_name)").replace("LOWER(floor_name)", "LOWER(floor_name)") : ""
        } ORDER BY id`,
        roomParams
      );

      const wardMasters = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.WARD)} ORDER BY id`
      ).catch(() => ({ rows: [] }));

      const bedMasters = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} ORDER BY id`,
        []
      ).catch(() => ({ rows: [] }));

      return NextResponse.json({
        buildings: buildings.rows,
        floors: floors.rows,
        floorDepartments: floorDepts.rows,
        wardInstances: wardInstances.rows,
        wardMasters: wardMasters.rows,
        rooms: rooms.rows,
        beds: bedMasters.rows,
      });
    }

    // Dashboard stats
    if (action === "stats") {
      const bedTableExists = await tableExists(pool, TABLE_NAMES.BED);
      if (!bedTableExists) {
        return NextResponse.json({
          totalBeds: 0,
          occupied: 0,
          available: 0,
          reserved: 0,
          maintenance: 0,
          cleaning: 0,
          blocked: 0,
          occupancyPercent: 0,
          departmentWise: [],
          wardWise: [],
        });
      }

      const statusCounts = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Occupied') AS occupied,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Available') AS available,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Reserved') AS reserved,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Maintenance') AS maintenance,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Cleaning') AS cleaning,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Blocked') AS blocked
        FROM ${quoteIdentifier(TABLE_NAMES.BED)}
      `);

      const stats = statusCounts.rows[0];
      const total = Number(stats.total) || 0;
      const occupied = Number(stats.occupied) || 0;

      const deptWise = await pool.query(`
        SELECT
          COALESCE(department_name, 'Unassigned') AS department,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Occupied') AS occupied,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Available') AS available
        FROM ${quoteIdentifier(TABLE_NAMES.BED)}
        GROUP BY department_name
        ORDER BY department_name
      `);

      const wardWise = await pool.query(`
        SELECT
          COALESCE(ward_name, 'Unassigned') AS ward,
          COALESCE(department_name, 'Unassigned') AS department,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Occupied') AS occupied,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Available') AS available
        FROM ${quoteIdentifier(TABLE_NAMES.BED)}
        GROUP BY ward_name, department_name
        ORDER BY ward_name
      `);

      return NextResponse.json({
        totalBeds: total,
        occupied,
        available: Number(stats.available) || 0,
        reserved: Number(stats.reserved) || 0,
        maintenance: Number(stats.maintenance) || 0,
        cleaning: Number(stats.cleaning) || 0,
        blocked: Number(stats.blocked) || 0,
        occupancyPercent: total > 0 ? Math.round((occupied / total) * 100) : 0,
        departmentWise: deptWise.rows,
        wardWise: wardWise.rows,
      });
    }

    // Allocations list
    if (action === "allocations") {
      const status = searchParams.get("status") || "Active";
      const allocations = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
         WHERE status = $1
         ORDER BY allocated_at DESC LIMIT 200`,
        [status]
      );
      return NextResponse.json({ rows: allocations.rows });
    }

    // Transfer history
    if (action === "transfers") {
      const patientId = searchParams.get("patientId");
      let transfers;
      if (patientId) {
        transfers = await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)}
           WHERE patient_id = $1
           ORDER BY transferred_at DESC LIMIT 200`,
          [patientId]
        );
      } else {
        transfers = await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)}
           ORDER BY transferred_at DESC LIMIT 200`
        );
      }
      return NextResponse.json({ rows: transfers.rows });
    }

    // Housekeeping tasks (Stage 3)
    if (action === "housekeeping") {
      const ward = searchParams.get("ward");
      const status = searchParams.get("status"); // Pending|InProgress|Complete|all
      let query = `SELECT * FROM housekeeping_task WHERE 1=1`;
      const qParams: unknown[] = [];
      if (ward) { qParams.push(ward); query += ` AND ward_name = $${qParams.length}`; }
      if (status && status !== "all") { qParams.push(status); query += ` AND status = $${qParams.length}`; }
      else if (!status) { query += ` AND status IN ('Pending','InProgress')`; }
      query += ` ORDER BY vacated_at DESC LIMIT 200`;
      const rows = await pool.query(query, qParams);
      return NextResponse.json({ rows: rows.rows });
    }

    // Reservations (Stage 5)
    if (action === "reservations") {
      const rows = await pool.query(
        `SELECT a.*, b.description AS bed_desc, b.room_name, b.ward_name, b.floor_name, b.building_name, b.charge
         FROM ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)} a
         LEFT JOIN ${quoteIdentifier(TABLE_NAMES.BED)} b ON b.id = a.bed_id
         WHERE a.status = 'Reserved'
         ORDER BY a.allocated_at DESC LIMIT 200`
      );
      return NextResponse.json({ rows: rows.rows });
    }

    // Billing lines for a patient (Stage 2)
    if (action === "billingLines") {
      const patientId = searchParams.get("patientId");
      if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
      const rows = await pool.query(
        `SELECT * FROM bed_billing_line WHERE patient_id = $1 ORDER BY start_at DESC`,
        [patientId]
      );
      return NextResponse.json({ rows: rows.rows });
    }

    // Reports data

    if (action === "reports") {
      const reportType = searchParams.get("reportType") || "bed-occupancy";
      const bedTableExists = await tableExists(pool, TABLE_NAMES.BED);
      if (!bedTableExists) {
        return NextResponse.json({ rows: [] });
      }

      if (reportType === "bed-occupancy" || reportType === "bed-utilization") {
        const rows = await pool.query(
          `SELECT code, description AS bed_name, bed_type, status, charge, ward_name, room_name,
                  floor_name, building_name, department_name, patient_id, patient_name
           FROM ${quoteIdentifier(TABLE_NAMES.BED)}
           ORDER BY building_name, floor_name, department_name, ward_name, room_name, code`
        );
        return NextResponse.json({ rows: rows.rows });
      }

      if (reportType === "ward-occupancy") {
        const rows = await pool.query(
          `SELECT ward_name AS ward, department_name AS department,
                  COUNT(*) AS total_beds,
                  COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Occupied') AS occupied,
                  COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Available') AS available
           FROM ${quoteIdentifier(TABLE_NAMES.BED)}
           GROUP BY ward_name, department_name
           ORDER BY ward_name`
        );
        return NextResponse.json({ rows: rows.rows });
      }

      if (reportType === "floor-occupancy") {
        const rows = await pool.query(
          `SELECT floor_name AS floor, building_name AS building,
                  COUNT(*) AS total_beds,
                  COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Occupied') AS occupied,
                  COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Available') AS available
           FROM ${quoteIdentifier(TABLE_NAMES.BED)}
           GROUP BY floor_name, building_name
           ORDER BY building_name, floor_name`
        );
        return NextResponse.json({ rows: rows.rows });
      }

      if (reportType === "building-occupancy") {
        const rows = await pool.query(
          `SELECT building_name AS building,
                  COUNT(*) AS total_beds,
                  COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Occupied') AS occupied,
                  COUNT(*) FILTER (WHERE COALESCE(status, 'Available') = 'Available') AS available
           FROM ${quoteIdentifier(TABLE_NAMES.BED)}
           GROUP BY building_name
           ORDER BY building_name`
        );
        return NextResponse.json({ rows: rows.rows });
      }

      if (reportType === "admission") {
        const rows = await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           ORDER BY allocated_at DESC LIMIT 500`
        );
        return NextResponse.json({ rows: rows.rows });
      }

      if (reportType === "transfer") {
        const rows = await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)}
           ORDER BY transferred_at DESC LIMIT 500`
        );
        return NextResponse.json({ rows: rows.rows });
      }

      return NextResponse.json({ rows: [] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch infrastructure data.";
    console.error("[infrastructure GET]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── POST: Create infrastructure (generator + manual) ─── */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureInfrastructureTables(pool);

    const body = await request.json();
    const action = body.action ?? "generate";

    // Bulk generate
    if (action === "generate") {
      const config = body.config;
      if (!config) {
        return NextResponse.json({ error: "Generator config is required." }, { status: 400 });
      }

      const results: {
        buildings: number;
        floors: number;
        departments: number;
        wards: number;
        rooms: number;
        beds: number;
      } = { buildings: 0, floors: 0, departments: 0, wards: 0, rooms: 0, beds: 0 };

      const buildingCount = Number(config.buildingCount) || 1;
      const floorsPerBuilding = Number(config.floorsPerBuilding) || 1;
      const departmentsPerFloor = Number(config.departmentsPerFloor) || 1;
      const wardsPerDepartment = Number(config.wardsPerDepartment) || 1;
      const roomsPerWard = Number(config.roomsPerWard) || 1;
      const bedsPerRoom = Number(config.bedsPerRoom) || 1;
      const selectedDepartments: string[] = config.selectedDepartments ?? [];
      const selectedWardTypes: string[] = config.selectedWardTypes ?? [];
      const roomType = config.roomType ?? "";
      const roomPurpose = config.roomPurpose ?? "Patient Room";
      const bedType = config.bedType ?? "Standard";

      for (let b = 0; b < buildingCount; b++) {
        const building = await createBuilding(pool, {
          buildingName: `Building ${String.fromCharCode(65 + b)}`,
          description: `Auto-generated Building ${String.fromCharCode(65 + b)}`,
        });
        results.buildings++;

        for (let f = 0; f < floorsPerBuilding; f++) {
          const floor = await createFloor(pool, {
            buildingId: Number(building.id),
            buildingName: building.building_name,
            floorNumber: f,
          });
          results.floors++;

          const deptCount = Math.min(departmentsPerFloor, selectedDepartments.length || departmentsPerFloor);

          for (let d = 0; d < deptCount; d++) {
            const deptName = selectedDepartments[d] || `Department ${d + 1}`;
            const assignment = await createFloorDeptAssignment(pool, {
              floorId: Number(floor.id),
              floorName: floor.floor_name,
              buildingId: Number(building.id),
              buildingName: building.building_name,
              departmentId: d + 1,
              departmentName: deptName,
            });
            results.departments++;

            const wardCount = Math.min(wardsPerDepartment, selectedWardTypes.length || wardsPerDepartment);

            for (let w = 0; w < wardCount; w++) {
              const wardType = selectedWardTypes[w] || `Ward ${w + 1}`;
              const wardInstance = await createWardInstance(pool, {
                wardType,
                floorDeptAssignmentId: Number(assignment.id),
                buildingName: building.building_name,
                floorName: floor.floor_name,
                departmentName: deptName,
              });
              results.wards++;

              for (let r = 0; r < roomsPerWard; r++) {
                const room = await createRoom(pool, {
                  wardInstanceId: Number(wardInstance.id),
                  floorNumber: f,
                  roomIndex: d * wardsPerDepartment * roomsPerWard + w * roomsPerWard + r,
                  roomType,
                  roomPurpose,
                  capacity: bedsPerRoom,
                  rate: 0,
                  buildingName: building.building_name,
                  floorName: floor.floor_name,
                  departmentName: deptName,
                  wardName: wardType,
                });
                results.rooms++;

                for (let bed = 0; bed < bedsPerRoom; bed++) {
                  await createBed(pool, {
                    roomId: Number(room.id),
                    bedIndex: bed,
                    bedType,
                    charge: 0,
                    buildingName: building.building_name,
                    floorName: floor.floor_name,
                    departmentName: deptName,
                    wardName: wardType,
                    roomName: room.description || generateRoomName(f, r),
                    ward: wardType,
                  });
                  results.beds++;
                }
              }
            }
          }
        }
      }

      return NextResponse.json({ success: true, results }, { status: 201 });
    }

    // Interactive Designer Wizard Generate
    if (action === "wizardGenerate") {
      const buildings = body.buildings;
      if (!Array.isArray(buildings) || buildings.length === 0) {
        return NextResponse.json({ error: "At least one building is required in wizard configuration." }, { status: 400 });
      }

      // Erase existing infrastructure tables to prevent duplicate entries
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)}`);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.ROOM)}`);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)}`);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)}`);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR)}`);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)}`);

      const results = { buildings: 0, floors: 0, departments: 0, wards: 0, rooms: 0, beds: 0 };

      for (let bIndex = 0; bIndex < buildings.length; bIndex++) {
        const bConfig = buildings[bIndex];
        const bName = String(bConfig.name || `Building ${String.fromCharCode(65 + bIndex)}`).trim();
        const bCode = String(bConfig.code || `BLD-${String.fromCharCode(65 + bIndex)}`).trim();
        const bDesc = String(bConfig.description || `Hospital ${bName}`).trim();

        const building = await createBuilding(pool, {
          buildingName: bName,
          code: bCode,
          description: bDesc,
        });
        results.buildings++;

        const floors = Array.isArray(bConfig.floors) ? bConfig.floors : [];
        for (let fIndex = 0; fIndex < floors.length; fIndex++) {
          const fConfig = floors[fIndex];
          const fName = String(fConfig.floorName || (fIndex === 0 ? "Ground Floor" : `Floor ${fIndex}`)).trim();
          const fNum = typeof fConfig.floorNumber === "number" ? fConfig.floorNumber : fIndex;

          const floor = await createFloor(pool, {
            buildingId: Number(building.id),
            buildingName: building.building_name,
            floorNumber: fNum,
            floorName: fName,
          });
          results.floors++;

          const departments = Array.isArray(fConfig.departments) ? fConfig.departments : [];
          for (let dIndex = 0; dIndex < departments.length; dIndex++) {
            const dConfig = departments[dIndex];
            const dName = String(dConfig.departmentName || `Department ${dIndex + 1}`).trim();

            const assignment = await createFloorDeptAssignment(pool, {
              floorId: Number(floor.id),
              floorName: floor.floor_name,
              buildingId: Number(building.id),
              buildingName: building.building_name,
              departmentId: dIndex + 1,
              departmentName: dName,
            });
            results.departments++;

            const wardInstanceMap = new Map<string, Record<string, unknown>>();

            const rooms = Array.isArray(dConfig.rooms) ? dConfig.rooms : [];
            for (let rIndex = 0; rIndex < rooms.length; rIndex++) {
              const rConfig = rooms[rIndex];
              const rName = String(rConfig.name || `Room ${rIndex + 1}`).trim();
              const rType = String(rConfig.type || "Standard").trim();
              const rPurpose = String(rConfig.purpose || "Patient Room").trim();
              const capacity = Number(rConfig.capacity) || 1;
              const rate = Number(rConfig.rate) || 0;
              const bedCount = Number(rConfig.bedCount) || 0;
              const bedType = String(rConfig.bedType || "Standard").trim();
              const wardType = rConfig.wardType ? String(rConfig.wardType).trim() : undefined;

              let wardInstanceId: number | undefined = undefined;
              let wardNameStr: string | undefined = undefined;

              if (wardType) {
                if (!wardInstanceMap.has(wardType)) {
                  const newWardInst = await createWardInstance(pool, {
                    wardType,
                    floorDeptAssignmentId: Number(assignment.id),
                    buildingName: building.building_name,
                    floorName: floor.floor_name,
                    departmentName: dName,
                  });
                  wardInstanceMap.set(wardType, newWardInst);
                  results.wards++;
                }
                const inst = wardInstanceMap.get(wardType);
                if (inst) {
                  wardInstanceId = Number(inst.id);
                  wardNameStr = wardType;
                }
              }

              const room = await createRoom(pool, {
                wardInstanceId,
                floorNumber: fNum,
                roomIndex: rIndex,
                roomType: rType,
                roomPurpose: rPurpose,
                capacity: capacity,
                rate: rate,
                buildingName: building.building_name,
                floorName: floor.floor_name,
                departmentName: dName,
                wardName: wardNameStr,
                description: rName,
              });
              results.rooms++;

              if (Array.isArray(rConfig.beds) && rConfig.beds.length > 0) {
                for (let bedIdx = 0; bedIdx < rConfig.beds.length; bedIdx++) {
                  const bedConf = rConfig.beds[bedIdx];
                  await createBed(pool, {
                    roomId: Number(room.id),
                    bedIndex: bedIdx,
                    bedType: bedConf.bedType || bedType,
                    charge: Number(bedConf.charge) || 0,
                    buildingName: building.building_name,
                    floorName: floor.floor_name,
                    departmentName: dName,
                    wardName: wardNameStr,
                    roomName: rName,
                    ward: wardNameStr,
                    description: bedConf.bedNumber || bedConf.description,
                  });
                  results.beds++;
                }
              } else if (bedCount > 0) {
                for (let bedIdx = 0; bedIdx < bedCount; bedIdx++) {
                  await createBed(pool, {
                    roomId: Number(room.id),
                    bedIndex: bedIdx,
                    bedType: bedType,
                    charge: 0,
                    buildingName: building.building_name,
                    floorName: floor.floor_name,
                    departmentName: dName,
                    wardName: wardNameStr,
                    roomName: rName,
                    ward: wardNameStr,
                  });
                  results.beds++;
                }
              }
            }
          }
        }
      }

      return NextResponse.json({ success: true, results }, { status: 201 });
    }

    // Allocate a bed — Stage 1: patient validation + Stage 2: billing line
    if (action === "allocate") {
      const { bedId, patientId, patientName } = body;
      if (!bedId || !patientId || !patientName) {
        return NextResponse.json(
          { error: "bedId, patientId, and patientName are required." },
          { status: 400 }
        );
      }

      const performedBy = await getSessionUser(Hname);

      // --- Stage 1: Validate patient exists in patient_registration ---
      const patientCheck = await pool.query(
        `SELECT patient_id, patient_name FROM patient_registration WHERE patient_id = $1 LIMIT 1`,
        [patientId]
      );
      if ((patientCheck.rowCount ?? 0) === 0) {
        return NextResponse.json(
          { error: `Patient ID "${patientId}" not found in patient records. Please register the patient first or use the patient search to select a valid patient.` },
          { status: 422 }
        );
      }
      const validatedName = patientCheck.rows[0].patient_name as string;

      // --- Stage 1: Block duplicate active allocation ---
      const dupCheck = await pool.query(
        `SELECT id, description, room_name, ward_name, floor_name FROM ${quoteIdentifier(TABLE_NAMES.BED)}
         WHERE patient_id = $1 AND status IN ('Occupied', 'Reserved') LIMIT 1`,
        [patientId]
      );
      if ((dupCheck.rowCount ?? 0) > 0) {
        const dup = dupCheck.rows[0];
        return NextResponse.json(
          { error: `Patient ${validatedName} (${patientId}) already has an active bed allocation: ${String(dup.description || "")} in ${String(dup.room_name || "")} / ${String(dup.ward_name || "")} / ${String(dup.floor_name || "")}. Use Bed Transfer instead.` },
          { status: 409 }
        );
      }

      // --- State machine: Available → Occupied ---
      const bed = await transitionBedStatus(pool, Number(bedId), "Occupied", performedBy, `Allocated to patient ${validatedName} (${patientId})`);

      // Link patient on the bed record
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)} SET patient_id = $2, patient_name = $3, updated_at = NOW() WHERE id = $1`,
        [bedId, patientId, validatedName]
      );

      // Create allocation record
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           (bed_id, patient_id, patient_name, building_name, floor_name, department_name,
            ward_name, room_name, bed_name, allocated_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          bedId, patientId, validatedName,
          bed.building_name, bed.floor_name, bed.department_name,
          bed.ward_name, bed.room_name, bed.description || bed.bed_number,
          performedBy,
        ]
      );

      // --- Stage 2: Open billing line ---
      await createBillingLine(pool, { patientId, patientName: validatedName, bed, createdBy: performedBy });

      // Update room status
      await updateRoomStatus(pool, Number(bed.room_id));

      return NextResponse.json({ success: true, patientName: validatedName });
    }

    // Transfer a bed — Stage 2+3: billing split + housekeeping task
    if (action === "transfer") {
      const { patientId, patientName, oldBedId, newBedId, reason } = body;
      if (!patientId || !oldBedId || !newBedId) {
        return NextResponse.json(
          { error: "patientId, oldBedId, and newBedId are required." },
          { status: 400 }
        );
      }

      const performedBy = await getSessionUser(Hname);

      const oldBedResult = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id = $1`,
        [oldBedId]
      );
      const oldBed = oldBedResult.rows[0];
      if (!oldBed) return NextResponse.json({ error: "Old bed not found." }, { status: 404 });

      const newBedResult = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id = $1`,
        [newBedId]
      );
      const newBed = newBedResult.rows[0];
      if (!newBed) return NextResponse.json({ error: "New bed not found." }, { status: 404 });
      if (!(["Available", "Reserved"].includes(newBed.status || "Available"))) {
        return NextResponse.json({ error: `New bed is ${String(newBed.status)} and cannot be occupied.` }, { status: 409 });
      }

      // --- Stage 3: Release old bed → Cleaning + housekeeping task ---
      await vacateBed(pool, oldBed, performedBy, `Transfer out: patient ${patientName}`);

      // --- Stage 2: Close billing line for old bed ---
      await closeBillingLine(pool, Number(oldBedId), String(patientId));

      // --- State machine: new bed → Occupied ---
      await transitionBedStatus(pool, Number(newBedId), "Occupied", performedBy, `Transfer in: patient ${patientName}`);
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)} SET patient_id = $2, patient_name = $3, updated_at = NOW() WHERE id = $1`,
        [newBedId, patientId, patientName]
      );

      // Update old allocation to Transferred
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
         SET status = 'Transferred', discharged_at = NOW(), updated_at = NOW()
         WHERE bed_id = $1 AND patient_id = $2 AND status = 'Active'`,
        [oldBedId, patientId]
      );

      // Create new allocation for new bed
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           (bed_id, patient_id, patient_name, building_name, floor_name, department_name,
            ward_name, room_name, bed_name, allocated_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          newBedId, patientId, patientName,
          newBed.building_name, newBed.floor_name, newBed.department_name,
          newBed.ward_name, newBed.room_name, newBed.description || newBed.bed_number,
          performedBy,
        ]
      );

      // Transfer history record
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)}
           (patient_id, patient_name, old_bed_id, old_bed_name, old_room_name, old_ward_name,
            old_floor_name, old_building_name, new_bed_id, new_bed_name, new_room_name,
            new_ward_name, new_floor_name, new_building_name, transferred_by_name, reason, event_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'Transfer')`,
        [
          patientId, patientName,
          oldBedId, oldBed.description || oldBed.bed_number, oldBed.room_name, oldBed.ward_name,
          oldBed.floor_name, oldBed.building_name,
          newBedId, newBed.description || newBed.bed_number, newBed.room_name, newBed.ward_name,
          newBed.floor_name, newBed.building_name,
          performedBy, reason || null,
        ]
      );

      // --- Stage 2: Open billing line for new bed ---
      await createBillingLine(pool, { patientId: String(patientId), patientName: String(patientName), bed: newBed, createdBy: performedBy });

      // Update room statuses
      if (oldBed.room_id) await updateRoomStatus(pool, Number(oldBed.room_id));
      if (newBed.room_id) await updateRoomStatus(pool, Number(newBed.room_id));

      return NextResponse.json({ success: true });
    }

    // Update bed status
    if (action === "updateBedStatus") {
      const { bedId, newStatus, changedByName, changedByRole, reason } = body;
      if (!bedId || !newStatus) {
        return NextResponse.json({ error: "bedId and newStatus are required." }, { status: 400 });
      }

      const bedResult = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id = $1`,
        [bedId]
      );
      const bed = bedResult.rows[0];
      if (!bed) return NextResponse.json({ error: "Bed not found." }, { status: 404 });

      const oldStatus = bed.status || "Available";

      // If changing from Occupied to something else, clear patient
      const clearPatient = oldStatus === "Occupied" && newStatus !== "Occupied";
      if (clearPatient) {
        await pool.query(
          `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)}
           SET status = $2, patient_id = NULL, patient_name = NULL, updated_at = NOW()
           WHERE id = $1`,
          [bedId, newStatus]
        );
        // Mark allocation as discharged
        await pool.query(
          `UPDATE ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           SET status = 'Discharged', discharged_at = NOW(), updated_at = NOW()
           WHERE bed_id = $1 AND status = 'Active'`,
          [bedId]
        );
      } else {
        await pool.query(
          `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)} SET status = $2, updated_at = NOW() WHERE id = $1`,
          [bedId, newStatus]
        );
      }

      // Audit
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_STATUS_AUDIT)}
           (bed_id, bed_name, old_status, new_status, changed_by_name, changed_by_role, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [bedId, bed.description || bed.bed_number, oldStatus, newStatus, changedByName || null, changedByRole || null, reason || null]
      );

      // Update room status
      if (bed.room_id) await updateRoomStatus(pool, Number(bed.room_id));

      return NextResponse.json({ success: true });
    }

    /* \u2500\u2500 Stage 4: Discharge \u2500\u2500 */
    if (action === "discharge") {
      const { patientId, dischargeReason, dischargeNotes } = body;
      if (!patientId || !dischargeReason) {
        return NextResponse.json({ error: "patientId and dischargeReason are required." }, { status: 400 });
      }

      const performedBy = await getSessionUser(Hname);

      // Find the patient's active bed
      const bedRes = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE patient_id = $1 AND status = 'Occupied' LIMIT 1`,
        [patientId]
      );
      const bed = bedRes.rows[0];
      if (!bed) {
        return NextResponse.json({ error: "No occupied bed found for this patient." }, { status: 404 });
      }

      // Find active allocation for admission timestamp
      const allocRes = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)} WHERE patient_id = $1 AND status = 'Active' ORDER BY allocated_at ASC LIMIT 1`,
        [patientId]
      );
      const allocation = allocRes.rows[0];
      const admissionAt = allocation?.allocated_at ? new Date(String(allocation.allocated_at)) : new Date();

      // --- Stage 3: Vacate bed \u2192 Cleaning + housekeeping task ---
      await vacateBed(pool, bed, performedBy, `Discharge: ${dischargeReason}`);

      // --- Stage 2: Close billing line and compute total ---
      const bedAmount = await closeBillingLine(pool, Number(bed.id), String(patientId));

      // Sum all closed billing lines for this admission
      const billTotals = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS grand_total FROM bed_billing_line WHERE patient_id = $1 AND status = 'Closed'`,
        [patientId]
      );
      const grandTotal = Number(billTotals.rows[0]?.grand_total ?? 0);

      // Generate an invoice number for the IP admission
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const invCountRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM billing_invoice WHERE invoice_number LIKE $1`,
        [`INV-IP-${today}-%`]
      );
      const invSeq = (Number(invCountRes.rows[0]?.cnt) || 0) + 1;
      const invoiceNumber = `INV-IP-${today}-${String(invSeq).padStart(4, "0")}`;

      // Create IP admission billing invoice
      await pool.query(
        `INSERT INTO billing_invoice
           (invoice_number, patient_name, token_number, billing_type, subtotal, payable_amount,
            payment_status, doctor_name, details, remarks, patient_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending', NULL, $7, $8, $9)`,
        [
          invoiceNumber,
          bed.patient_name, patientId,
          "IP Admission",
          grandTotal, grandTotal,
          JSON.stringify({ bedAmount, grandTotal, bedName: bed.description || bed.bed_number, ward: bed.ward_name }),
          dischargeNotes || null,
          patientId,
        ]
      );

      // Update billing lines with invoice ref
      await pool.query(
        `UPDATE bed_billing_line SET admission_ref = $1, updated_at = NOW() WHERE patient_id = $2 AND status = 'Closed' AND admission_ref IS NULL`,
        [invoiceNumber, patientId]
      );

      // Mark allocation as Discharged
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
         SET status = 'Discharged', discharged_at = NOW(), updated_at = NOW()
         WHERE patient_id = $1 AND status = 'Active'`,
        [patientId]
      );

      // Write discharge event in transfer history
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)}
           (patient_id, patient_name, old_bed_id, old_bed_name, old_room_name, old_ward_name,
            old_floor_name, old_building_name, transferred_by_name, reason, event_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Discharge')`,
        [
          patientId, bed.patient_name,
          bed.id, bed.description || bed.bed_number, bed.room_name, bed.ward_name,
          bed.floor_name, bed.building_name,
          performedBy, dischargeReason,
        ]
      );

      if (bed.room_id) await updateRoomStatus(pool, Number(bed.room_id));

      return NextResponse.json({ success: true, invoiceNumber, grandTotal });
    }

    /* \u2500\u2500 Stage 3: Housekeeping \u2500\u2500 */
    if (action === "hkClaim") {
      const { taskId } = body;
      if (!taskId) return NextResponse.json({ error: "taskId required." }, { status: 400 });
      const performedBy = await getSessionUser(Hname);
      await pool.query(
        `UPDATE housekeeping_task SET status='InProgress', assigned_to=$1, started_at=NOW(), updated_at=NOW() WHERE id=$2`,
        [performedBy, taskId]
      );
      return NextResponse.json({ success: true });
    }

    if (action === "hkComplete") {
      const { taskId } = body;
      if (!taskId) return NextResponse.json({ error: "taskId required." }, { status: 400 });
      const performedBy = await getSessionUser(Hname);

      const taskRes = await pool.query(`SELECT * FROM housekeeping_task WHERE id = $1`, [taskId]);
      const task = taskRes.rows[0];
      if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

      await pool.query(
        `UPDATE housekeeping_task SET status='Complete', completed_by=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2`,
        [performedBy, taskId]
      );

      // State machine: Cleaning \u2192 Available
      await transitionBedStatus(pool, Number(task.bed_id), "Available", performedBy, "Housekeeping complete");
      if (task.room_id) await updateRoomStatus(pool, Number(task.room_id));

      return NextResponse.json({ success: true });
    }

    /* \u2500\u2500 Stage 5: Reservation \u2500\u2500 */
    if (action === "reserve") {
      const { bedId, patientId, patientName, reservedFrom, reservedUntil, notes } = body;
      if (!bedId || !patientId) return NextResponse.json({ error: "bedId and patientId required." }, { status: 400 });

      const performedBy = await getSessionUser(Hname);

      // Validate patient
      const patientCheck = await pool.query(
        `SELECT patient_id, patient_name FROM patient_registration WHERE patient_id = $1 LIMIT 1`,
        [patientId]
      );
      if ((patientCheck.rowCount ?? 0) === 0) {
        return NextResponse.json({ error: `Patient ID "${patientId}" not found in patient records.` }, { status: 422 });
      }
      const validatedName = (patientCheck.rows[0].patient_name as string) || patientName;

      // State machine: Available \u2192 Reserved
      const bed = await transitionBedStatus(pool, Number(bedId), "Reserved", performedBy, `Reserved for ${validatedName}`);
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)} SET patient_id=$2, patient_name=$3, updated_at=NOW() WHERE id=$1`,
        [bedId, patientId, validatedName]
      );

      // Create reservation allocation
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           (bed_id, patient_id, patient_name, building_name, floor_name, department_name,
            ward_name, room_name, bed_name, allocated_by_name, allocated_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Reserved')`,
        [
          bedId, patientId, validatedName,
          bed.building_name, bed.floor_name, bed.department_name,
          bed.ward_name, bed.room_name, bed.description || bed.bed_number,
          performedBy,
          reservedFrom ? new Date(String(reservedFrom)) : new Date(),
        ]
      );

      if (bed.room_id) await updateRoomStatus(pool, Number(bed.room_id));
      return NextResponse.json({ success: true });
    }

    if (action === "convertReservation") {
      const { bedId, patientId, patientName } = body;
      if (!bedId || !patientId) return NextResponse.json({ error: "bedId and patientId required." }, { status: 400 });

      const performedBy = await getSessionUser(Hname);

      // State machine: Reserved \u2192 Occupied
      const bed = await transitionBedStatus(pool, Number(bedId), "Occupied", performedBy, `Reservation converted to admission for patient ${patientId}`);

      // Update allocation from Reserved to Active
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)} SET status='Active', updated_at=NOW() WHERE bed_id=$1 AND patient_id=$2 AND status='Reserved'`,
        [bedId, patientId]
      );

      // Open billing line
      await createBillingLine(pool, { patientId: String(patientId), patientName: String(patientName || bed.patient_name), bed, createdBy: performedBy });

      if (bed.room_id) await updateRoomStatus(pool, Number(bed.room_id));
      return NextResponse.json({ success: true });
    }

    if (action === "releaseReservation") {
      const { bedId, patientId } = body;
      if (!bedId || !patientId) return NextResponse.json({ error: "bedId and patientId required." }, { status: 400 });

      const performedBy = await getSessionUser(Hname);

      // State machine: Reserved \u2192 Available
      const bed = await transitionBedStatus(pool, Number(bedId), "Available", performedBy, `Reservation released for patient ${patientId}`);

      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)} SET status='Cancelled', discharged_at=NOW(), updated_at=NOW() WHERE bed_id=$1 AND patient_id=$2 AND status='Reserved'`,
        [bedId, patientId]
      );

      if (bed.room_id) await updateRoomStatus(pool, Number(bed.room_id));
      return NextResponse.json({ success: true });
    }

    /* \u2500\u2500 Builder: Update Building \u2500\u2500 */

    if (action === "updateBuilding") {
      const { id, buildingName, code, description, status } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BUILDING)}
         SET building_name=$2, code=$3, description=$4, status=$5, updated_at=NOW()
         WHERE id=$1`,
        [id, buildingName, code, description, status]
      );
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Delete Building (cascade) ── */
    if (action === "deleteBuilding") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      // cascade: beds → rooms → ward_instances → floor_dept → floors → building
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE building_name = (SELECT building_name FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} WHERE id=$1)`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE building_name = (SELECT building_name FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} WHERE id=$1)`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} WHERE building_name = (SELECT building_name FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} WHERE id=$1)`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} WHERE building_id=$1`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR)} WHERE building_id=$1`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} WHERE id=$1`, [id]);
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Duplicate Building ── */
    if (action === "duplicateBuilding") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const orig = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} WHERE id=$1`, [id]);
      const b = orig.rows[0];
      if (!b) return NextResponse.json({ error: "Building not found" }, { status: 404 });
      const newName = `${b.building_name} (Copy)`;
      const newCode = `${String(b.code ?? "").substring(0, 8)}CPY`;
      const newBuilding = await createBuilding(pool, { buildingName: newName, code: newCode, description: String(b.description ?? ""), status: String(b.status ?? "Active") });
      return NextResponse.json({ success: true, building: newBuilding });
    }

    /* ── Builder: Generate Floors for a Building ── */
    if (action === "generateFloors") {
      const { buildingId, floorCount } = body;
      if (!buildingId || !floorCount) return NextResponse.json({ error: "buildingId and floorCount required" }, { status: 400 });
      const bRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BUILDING)} WHERE id=$1`, [buildingId]);
      const building = bRes.rows[0];
      if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });
      const created = [];
      for (let i = 0; i < Number(floorCount); i++) {
        const f = await createFloor(pool, { buildingId: Number(buildingId), buildingName: String(building.building_name), floorNumber: i });
        created.push(f);
      }
      return NextResponse.json({ success: true, floors: created });
    }

    /* ── Builder: Update Floor ── */
    if (action === "updateFloor") {
      const { id, floorName, floorNumber } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.FLOOR)} SET floor_name=$2, floor_number=$3, updated_at=NOW() WHERE id=$1`,
        [id, floorName, floorNumber]
      );
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Delete Floor (cascade) ── */
    if (action === "deleteFloor") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const fRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.FLOOR)} WHERE id=$1`, [id]);
      const floor = fRes.rows[0];
      if (!floor) return NextResponse.json({ error: "Floor not found" }, { status: 404 });
      const floorName = String(floor.floor_name);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE floor_name=$1`, [floorName]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE floor_name=$1`, [floorName]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} WHERE floor_name=$1`, [floorName]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} WHERE floor_id=$1`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR)} WHERE id=$1`, [id]);
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Assign Department to Floor ── */
    if (action === "assignDepartment") {
      const { floorId, floorName, buildingId, buildingName, departmentId, departmentName } = body;
      if (!floorId || !departmentName) return NextResponse.json({ error: "floorId and departmentName required" }, { status: 400 });
      // Avoid duplicates
      const existing = await pool.query(
        `SELECT id FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} WHERE floor_id=$1 AND department_name=$2`,
        [floorId, departmentName]
      );
      if (existing.rows.length > 0) return NextResponse.json({ error: "Department already assigned to this floor" }, { status: 409 });
      const assignment = await createFloorDeptAssignment(pool, {
        floorId: Number(floorId), floorName, buildingId: Number(buildingId), buildingName, departmentId: Number(departmentId) || 0, departmentName,
      });
      return NextResponse.json({ success: true, assignment });
    }

    /* ── Builder: Remove Department from Floor ── */
    if (action === "removeDepartment") {
      const { floorDeptId } = body;
      if (!floorDeptId) return NextResponse.json({ error: "floorDeptId required" }, { status: 400 });
      const fdRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} WHERE id=$1`, [floorDeptId]);
      const fd = fdRes.rows[0];
      if (fd) {
        await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE floor_name=$1 AND department_name=$2`, [fd.floor_name, fd.department_name]);
        await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE floor_name=$1 AND department_name=$2`, [fd.floor_name, fd.department_name]);
        const wards = await pool.query(`SELECT id FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} WHERE floor_dept_assignment_id=$1`, [floorDeptId]);
        for (const w of wards.rows) {
          await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} WHERE id=$1`, [w.id]);
        }
      }
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} WHERE id=$1`, [floorDeptId]);
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Generate Wards for a Floor-Dept ── */
    if (action === "generateWards") {
      const { floorDeptId, wardTypes } = body;
      if (!floorDeptId || !Array.isArray(wardTypes) || wardTypes.length === 0)
        return NextResponse.json({ error: "floorDeptId and wardTypes[] required" }, { status: 400 });
      const fdRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.FLOOR_DEPT)} WHERE id=$1`, [floorDeptId]);
      const fd = fdRes.rows[0];
      if (!fd) return NextResponse.json({ error: "Floor-department assignment not found" }, { status: 404 });
      const created = [];
      for (const wt of wardTypes as string[]) {
        const w = await createWardInstance(pool, {
          wardType: wt, floorDeptAssignmentId: Number(floorDeptId),
          buildingName: String(fd.building_name), floorName: String(fd.floor_name), departmentName: String(fd.department_name),
        });
        created.push(w);
      }
      return NextResponse.json({ success: true, wards: created });
    }

    /* ── Builder: Update Ward Instance ── */
    if (action === "updateWard") {
      const { id, wardType, status } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} SET ward_type=$2, status=$3, updated_at=NOW() WHERE id=$1`,
        [id, wardType, status]
      );
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Remove Ward Instance (cascade) ── */
    if (action === "removeWard") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE room_id IN (SELECT id FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE ward_instance_id=$1)`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE ward_instance_id=$1`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} WHERE id=$1`, [id]);
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Generate Rooms for a Ward ── */
    if (action === "generateRooms") {
      const { wardId, roomCount, roomType, roomPurpose, capacity, rate } = body;
      if (!wardId || !roomCount) return NextResponse.json({ error: "wardId and roomCount required" }, { status: 400 });
      const wRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.WARD_INSTANCE)} WHERE id=$1`, [wardId]);
      const ward = wRes.rows[0];
      if (!ward) return NextResponse.json({ error: "Ward not found" }, { status: 404 });
      // Determine current room count for indexing
      const existingRooms = await pool.query(`SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE ward_instance_id=$1`, [wardId]);
      const startIndex = Number(existingRooms.rows[0]?.cnt ?? 0);
      const created = [];
      for (let i = 0; i < Number(roomCount); i++) {
        const r = await createRoom(pool, {
          wardInstanceId: Number(wardId),
          floorNumber: 0,
          roomIndex: startIndex + i,
          roomType: roomType || "",
          roomPurpose: roomPurpose || "Patient Room",
          capacity: Number(capacity) || 1,
          rate: Number(rate) || 0,
          buildingName: String(ward.building_name),
          floorName: String(ward.floor_name),
          departmentName: String(ward.department_name),
          wardName: String(ward.ward_type),
        });
        created.push(r);
      }
      return NextResponse.json({ success: true, rooms: created });
    }

    /* ── Builder: Update Room ── */
    if (action === "updateRoom") {
      const { id, description, roomType, roomPurpose, capacity, rate, status } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.ROOM)}
         SET description=$2, room_type=$3, room_purpose=$4, capacity=$5, rate=$6, status=$7, updated_at=NOW()
         WHERE id=$1`,
        [id, description, roomType, roomPurpose, capacity, rate, status]
      );
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Delete Room (cascade) ── */
    if (action === "deleteRoom") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE room_id=$1`, [id]);
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE id=$1`, [id]);
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Generate Beds for a Room ── */
    if (action === "generateBeds") {
      const { roomId, bedCount, bedType, charge } = body;
      if (!roomId || !bedCount) return NextResponse.json({ error: "roomId and bedCount required" }, { status: 400 });
      const rRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.ROOM)} WHERE id=$1`, [roomId]);
      const room = rRes.rows[0];
      if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
      const existingBeds = await pool.query(`SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE room_id=$1`, [roomId]);
      const startIndex = Number(existingBeds.rows[0]?.cnt ?? 0);
      const created = [];
      for (let i = 0; i < Number(bedCount); i++) {
        const b = await createBed(pool, {
          roomId: Number(roomId),
          bedIndex: startIndex + i,
          bedType: bedType || "Standard",
          charge: Number(charge) || 0,
          buildingName: String(room.building_name),
          floorName: String(room.floor_name),
          departmentName: String(room.department_name),
          wardName: String(room.ward_name),
          roomName: String(room.description || room.code),
          ward: String(room.ward_name),
        });
        created.push(b);
      }
      return NextResponse.json({ success: true, beds: created });
    }

    /* ── Builder: Update Bed ── */
    if (action === "updateBed") {
      const { id, bedNumber, bedType, charge, status, description } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const oldBedRes = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id=$1`, [id]);
      const oldBed = oldBedRes.rows[0];
      if (!oldBed) return NextResponse.json({ error: "Bed not found" }, { status: 404 });
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)}
         SET bed_number=$2, bed_type=$3, charge=$4, rate=$4, status=$5, description=$6, updated_at=NOW()
         WHERE id=$1`,
        [id, bedNumber, bedType, charge, status, description]
      );
      if (oldBed.room_id) await updateRoomStatus(pool, Number(oldBed.room_id));
      return NextResponse.json({ success: true });
    }

    /* ── Builder: Delete Single Bed ── */
    if (action === "deleteBed") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const bedRes = await pool.query(`SELECT room_id FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id=$1`, [id]);
      const bed = bedRes.rows[0];
      await pool.query(`DELETE FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id=$1`, [id]);
      if (bed?.room_id) await updateRoomStatus(pool, Number(bed.room_id));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process infrastructure request.";
    console.error("[infrastructure POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── Helper: recompute room status from bed statuses ─── */

async function updateRoomStatus(pool: Pool, roomId: number) {
  if (!roomId) return;

  const bedsResult = await pool.query(
    `SELECT status FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE room_id = $1`,
    [roomId]
  );

  const beds = bedsResult.rows;
  if (beds.length === 0) return;

  const total = beds.length;
  const occupied = beds.filter((b: Record<string, unknown>) => b.status === "Occupied").length;
  const maintenance = beds.filter(
    (b: Record<string, unknown>) =>
      b.status === "Maintenance" || b.status === "Blocked"
  ).length;

  let roomStatus: string;
  if (maintenance === total) {
    roomStatus = "Maintenance";
  } else if (occupied === 0) {
    roomStatus = "Available";
  } else if (occupied >= total) {
    roomStatus = "Full";
  } else {
    roomStatus = "Partially Occupied";
  }

  await pool.query(
    `UPDATE ${quoteIdentifier(TABLE_NAMES.ROOM)} SET status = $2, updated_at = NOW() WHERE id = $1`,
    [roomId, roomStatus]
  );
}
