import { NextResponse } from "next/server";
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
    wardInstanceId: number;
    floorNumber: number;
    roomIndex: number;
    roomType?: string;
    roomPurpose?: string;
    capacity?: number;
    rate?: number;
    buildingName: string;
    floorName: string;
    departmentName: string;
    wardName: string;
  }
) {
  const roomName = generateRoomName(data.floorNumber, data.roomIndex);
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
    wardName: string;
    roomName: string;
    ward?: string;
  }
) {
  const bedName = generateBedName(data.bedIndex);
  const code = `${data.roomName.replace(/\s+/g, "")}B${data.bedIndex + 1}`;
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
          roomFilter = "WHERE building_name = $1";
          roomParams.push(String(buildingRow.building_name ?? ""));
          if (floorId) {
            const floorRow = floors.rows.find(
              (f: Record<string, unknown>) => String(f.id) === floorId
            );
            if (floorRow) {
              roomFilter += " AND floor_name = $2";
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
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} ${
          roomFilter ? roomFilter.replace("building_name", "building_name").replace("floor_name", "floor_name") : ""
        } ORDER BY id`,
        roomParams
      );

      return NextResponse.json({
        buildings: buildings.rows,
        floors: floors.rows,
        floorDepartments: floorDepts.rows,
        wardInstances: wardInstances.rows,
        rooms: rooms.rows,
        beds: beds.rows,
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
      const chargePerBed = Number(config.chargePerBed) || 0;
      const chargePerRoom = Number(config.chargePerRoom) || 0;

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
                  rate: chargePerRoom,
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
                    charge: chargePerBed,
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

    // Allocate a bed
    if (action === "allocate") {
      const { bedId, patientId, patientName, allocatedByName, allocatedByRole } = body;
      if (!bedId || !patientId || !patientName) {
        return NextResponse.json(
          { error: "bedId, patientId, and patientName are required." },
          { status: 400 }
        );
      }

      // Check bed is available
      const bedResult = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAMES.BED)} WHERE id = $1`,
        [bedId]
      );
      const bed = bedResult.rows[0];
      if (!bed) {
        return NextResponse.json({ error: "Bed not found." }, { status: 404 });
      }
      if (bed.status === "Occupied") {
        return NextResponse.json({ error: "Bed is already occupied." }, { status: 409 });
      }

      // Update bed status
      const oldStatus = bed.status || "Available";
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)}
         SET status = 'Occupied', patient_id = $2, patient_name = $3, updated_at = NOW()
         WHERE id = $1`,
        [bedId, patientId, patientName]
      );

      // Create allocation record
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           (bed_id, patient_id, patient_name, building_name, floor_name, department_name,
            ward_name, room_name, bed_name, allocated_by_name, allocated_by_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          bedId, patientId, patientName,
          bed.building_name, bed.floor_name, bed.department_name,
          bed.ward_name, bed.room_name, bed.description || bed.bed_number,
          allocatedByName || null, allocatedByRole || null,
        ]
      );

      // Audit
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_STATUS_AUDIT)}
           (bed_id, bed_name, old_status, new_status, changed_by_name, changed_by_role, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          bedId, bed.description || bed.bed_number,
          oldStatus, "Occupied",
          allocatedByName || null, allocatedByRole || null,
          `Allocated to patient ${patientName} (${patientId})`,
        ]
      );

      // Update room status
      await updateRoomStatus(pool, Number(bed.room_id));

      return NextResponse.json({ success: true });
    }

    // Transfer a bed
    if (action === "transfer") {
      const { patientId, patientName, oldBedId, newBedId, transferredByName, transferredByRole, reason } = body;
      if (!patientId || !oldBedId || !newBedId) {
        return NextResponse.json(
          { error: "patientId, oldBedId, and newBedId are required." },
          { status: 400 }
        );
      }

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
      if (newBed.status === "Occupied") {
        return NextResponse.json({ error: "New bed is already occupied." }, { status: 409 });
      }

      // Release old bed
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)}
         SET status = 'Available', patient_id = NULL, patient_name = NULL, updated_at = NOW()
         WHERE id = $1`,
        [oldBedId]
      );

      // Occupy new bed
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED)}
         SET status = 'Occupied', patient_id = $2, patient_name = $3, updated_at = NOW()
         WHERE id = $1`,
        [newBedId, patientId, patientName]
      );

      // Update old allocation to discharged
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
         SET status = 'Transferred', discharged_at = NOW(), updated_at = NOW()
         WHERE bed_id = $1 AND patient_id = $2 AND status = 'Active'`,
        [oldBedId, patientId]
      );

      // Create new allocation
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_ALLOCATION)}
           (bed_id, patient_id, patient_name, building_name, floor_name, department_name,
            ward_name, room_name, bed_name, allocated_by_name, allocated_by_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          newBedId, patientId, patientName,
          newBed.building_name, newBed.floor_name, newBed.department_name,
          newBed.ward_name, newBed.room_name, newBed.description || newBed.bed_number,
          transferredByName || null, transferredByRole || null,
        ]
      );

      // Transfer history
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_TRANSFER_HISTORY)}
           (patient_id, patient_name, old_bed_id, old_bed_name, old_room_name, old_ward_name,
            old_floor_name, old_building_name, new_bed_id, new_bed_name, new_room_name,
            new_ward_name, new_floor_name, new_building_name, transferred_by_name,
            transferred_by_role, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          patientId, patientName,
          oldBedId, oldBed.description || oldBed.bed_number, oldBed.room_name, oldBed.ward_name,
          oldBed.floor_name, oldBed.building_name,
          newBedId, newBed.description || newBed.bed_number, newBed.room_name, newBed.ward_name,
          newBed.floor_name, newBed.building_name,
          transferredByName || null, transferredByRole || null, reason || null,
        ]
      );

      // Audit for both beds
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_STATUS_AUDIT)}
           (bed_id, bed_name, old_status, new_status, changed_by_name, changed_by_role, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [oldBedId, oldBed.description, "Occupied", "Available", transferredByName, transferredByRole, `Transfer out: patient ${patientName}`]
      );
      await pool.query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAMES.BED_STATUS_AUDIT)}
           (bed_id, bed_name, old_status, new_status, changed_by_name, changed_by_role, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newBedId, newBed.description, newBed.status || "Available", "Occupied", transferredByName, transferredByRole, `Transfer in: patient ${patientName}`]
      );

      // Update room statuses for both
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
