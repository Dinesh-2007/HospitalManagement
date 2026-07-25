"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";

/* ─── Types ─── */
type Rec = Record<string, unknown>;

type HierarchyData = {
  buildings: Rec[];
  floors: Rec[];
  floorDepartments: Rec[];
  wardInstances: Rec[];
  rooms: Rec[];
  beds: Rec[];
};

type NodeType = "building" | "floor" | "department" | "ward" | "room" | "bed";

type SelectedNode = {
  type: NodeType;
  id: number;
  data: Rec;
  parentId?: number;
  parentData?: Rec;
};

/* ─── Status colour helpers ─── */
function bedColor(status: string) {
  switch (status) {
    case "Available": return "bg-green-500";
    case "Occupied": return "bg-red-500";
    case "Reserved": return "bg-blue-500";
    case "Cleaning": return "bg-yellow-400";
    case "Maintenance": return "bg-gray-400";
    default: return "bg-gray-300";
  }
}

function bedEmoji(status: string) {
  switch (status) {
    case "Available": return "🟢";
    case "Occupied": return "🔴";
    case "Reserved": return "🔵";
    case "Cleaning": return "🟡";
    case "Maintenance": return "⬜";
    default: return "⬜";
  }
}


/* ─── Small reusable components ─── */

function InputField({ label, id, value, onChange, type = "text", placeholder = "" }: {
  label: string; id: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        id={id} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

function SelectField({ label, id, value, onChange, options }: {
  label: string; id: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select
        id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="">— Select —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ActionBtn({ label, onClick, variant = "primary", disabled = false, small = false }: {
  label: string; onClick: () => void; variant?: "primary" | "danger" | "ghost" | "success";
  disabled?: boolean; small?: boolean;
}) {
  const base = `inline-flex items-center justify-center rounded-lg font-semibold transition focus:outline-none focus:ring-2 disabled:opacity-50 ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`;
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-300",
    ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-300",
  };
  return (
    <button type="button" className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}


/* ─── Node icons ─── */
const NODE_ICON: Record<NodeType, string> = {
  building: "🏢", floor: "🏗️", department: "🏥", ward: "🛏️", room: "🚪", bed: "🛌",
};

/* ─── Stat Card ─── */
function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <span className="text-lg">{icon}</span>
      <span className="text-xl font-bold text-blue-700">{value}</span>
      <span className="text-[11px] text-slate-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

/* ─── Tree Node ─── */
function TreeNode({
  icon, label, nodeId, selected, onSelect, onAdd, onEdit, onDelete, onDuplicate,
  children, level = 0, defaultOpen = false,
}: {
  icon: string; label: string; nodeId: string; selected: boolean;
  onSelect: () => void; onAdd?: () => void; onEdit?: () => void;
  onDelete?: () => void; onDuplicate?: () => void;
  children?: React.ReactNode; level?: number; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  return (
    <div style={{ paddingLeft: level * 14 }}>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${selected ? "bg-blue-100 text-blue-800" : "hover:bg-slate-100 text-slate-700"}`}
        onClick={() => { onSelect(); if (children) setOpen((o) => !o); }}
      >
        {children ? (
          <span className="text-xs text-slate-400 w-3 shrink-0">{open ? "▾" : "▸"}</span>
        ) : <span className="w-3 shrink-0" />}
        <span className="text-sm mr-0.5">{icon}</span>
        <span className="text-xs font-medium flex-1 truncate">{label}</span>
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 text-xs"
            onClick={(e) => { e.stopPropagation(); setShowMenu((s) => !s); }}
          >⋯</button>
          {showMenu && (
            <div ref={menuRef} className="absolute right-0 top-7 z-50 w-36 rounded-xl border border-slate-200 bg-white shadow-xl text-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {onEdit && <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 flex gap-2 items-center" onClick={() => { onEdit(); setShowMenu(false); }}>✏️ Edit</button>}
              {onAdd && <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 flex gap-2 items-center" onClick={() => { onAdd(); setShowMenu(false); }}>➕ Add Child</button>}
              {onDuplicate && <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 flex gap-2 items-center" onClick={() => { onDuplicate(); setShowMenu(false); }}>📋 Duplicate</button>}
              {onDelete && <button type="button" className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex gap-2 items-center" onClick={() => { onDelete(); setShowMenu(false); }}>🗑️ Delete</button>}
            </div>
          )}
        </div>
      </div>
      {open && children && <div>{children}</div>}
    </div>
  );
}


/* ─── Right Panel: Live Preview ─── */
function LivePreview({ selected, hierarchy }: { selected: SelectedNode | null; hierarchy: HierarchyData | null }) {
  if (!selected || !hierarchy) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <span className="text-5xl">🏗️</span>
        <p className="text-sm font-medium">Select a node to preview</p>
      </div>
    );
  }

  if (selected.type === "building") {
    const floors = hierarchy.floors.filter((f) => Number(f.building_id) === selected.id);
    return (
      <div className="p-4 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm">{String(selected.data.building_name)}</h3>
        <div className="grid grid-cols-2 gap-2">
          {floors.map((f) => {
            const depts = hierarchy.floorDepartments.filter((d) => Number(d.floor_id) === Number(f.id));
            return (
              <div key={String(f.id)} className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-center">
                <div className="text-lg">🏗️</div>
                <div className="text-xs font-semibold text-blue-800 truncate">{String(f.floor_name)}</div>
                <div className="text-[10px] text-blue-500">{depts.length} dept(s)</div>
              </div>
            );
          })}
          {floors.length === 0 && <p className="col-span-2 text-xs text-slate-400 text-center py-4">No floors yet</p>}
        </div>
      </div>
    );
  }

  if (selected.type === "floor") {
    const depts = hierarchy.floorDepartments.filter((d) => Number(d.floor_id) === selected.id);
    return (
      <div className="p-4 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm">{String(selected.data.floor_name)}</h3>
        <div className="grid grid-cols-1 gap-2">
          {depts.map((d) => (
            <div key={String(d.id)} className="rounded-lg border border-purple-100 bg-purple-50 p-2 flex items-center gap-2">
              <span className="text-base">🏥</span>
              <span className="text-xs font-semibold text-purple-800">{String(d.department_name)}</span>
            </div>
          ))}
          {depts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No departments assigned</p>}
        </div>
      </div>
    );
  }

  if (selected.type === "department") {
    const wards = hierarchy.wardInstances.filter((w) => Number(w.floor_dept_assignment_id) === selected.id);
    return (
      <div className="p-4 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm">{String(selected.data.department_name)}</h3>
        <div className="grid grid-cols-1 gap-2">
          {wards.map((w) => {
            const rooms = hierarchy.rooms.filter((r) => Number(r.ward_instance_id) === Number(w.id));
            return (
              <div key={String(w.id)} className="rounded-lg border border-teal-100 bg-teal-50 p-2 flex items-center gap-2">
                <span className="text-base">🛏️</span>
                <div>
                  <div className="text-xs font-semibold text-teal-800">{String(w.ward_type)}</div>
                  <div className="text-[10px] text-teal-500">{rooms.length} room(s)</div>
                </div>
              </div>
            );
          })}
          {wards.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No wards yet</p>}
        </div>
      </div>
    );
  }

  if (selected.type === "ward") {
    const rooms = hierarchy.rooms.filter((r) => Number(r.ward_instance_id) === selected.id);
    const statusColor = (s: string) => {
      switch (s) {
        case "Available": return "bg-green-100 border-green-300 text-green-800";
        case "Full": return "bg-red-100 border-red-300 text-red-800";
        case "Partially Occupied": return "bg-yellow-100 border-yellow-300 text-yellow-800";
        default: return "bg-gray-100 border-gray-300 text-gray-600";
      }
    };
    return (
      <div className="p-4 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm">{String(selected.data.ward_type)}</h3>
        <div className="grid grid-cols-3 gap-2">
          {rooms.map((r) => (
            <div key={String(r.id)} className={`rounded-lg border px-2 py-3 text-center text-xs font-semibold ${statusColor(String(r.status ?? "Available"))}`}>
              <div>🚪</div>
              <div className="truncate">{String(r.description ?? r.code)}</div>
            </div>
          ))}
          {rooms.length === 0 && <p className="col-span-3 text-xs text-slate-400 text-center py-4">No rooms yet</p>}
        </div>
      </div>
    );
  }

  if (selected.type === "room") {
    const beds = hierarchy.beds.filter((b) => Number(b.room_id) === selected.id);
    return (
      <div className="p-4 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm">{String(selected.data.description ?? selected.data.code)}</h3>
        <div className="space-y-1 mb-3">
          {[["Available","🟢"],["Occupied","🔴"],["Reserved","🔵"],["Cleaning","🟡"],["Maintenance","⬜"]].map(([s,e]) => (
            <div key={s} className="flex items-center gap-2 text-xs text-slate-600"><span>{e}</span><span>{s}</span></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {beds.map((b) => (
            <div key={String(b.id)} className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 ${
              String(b.status) === "Available" ? "border-green-300 bg-green-50" :
              String(b.status) === "Occupied" ? "border-red-300 bg-red-50" :
              String(b.status) === "Reserved" ? "border-blue-300 bg-blue-50" :
              String(b.status) === "Cleaning" ? "border-yellow-300 bg-yellow-50" :
              "border-gray-300 bg-gray-50"
            }`}>
              <span className="text-xl">{bedEmoji(String(b.status))}</span>
              <span className="text-xs font-bold text-slate-700">{String(b.bed_number ?? b.description)}</span>
              <span className="text-[10px] text-slate-500">{String(b.bed_type ?? "Standard")}</span>
            </div>
          ))}
          {beds.length === 0 && <p className="col-span-2 text-xs text-slate-400 text-center py-4">No beds yet</p>}
        </div>
      </div>
    );
  }

  if (selected.type === "bed") {
    const d = selected.data;
    const st = String(d.status ?? "Available");
    return (
      <div className="p-4 space-y-4">
        <h3 className="font-bold text-slate-800 text-sm">Bed Detail</h3>
        <div className={`rounded-2xl border-2 p-6 flex flex-col items-center gap-2 ${
          st === "Available" ? "border-green-400 bg-green-50" :
          st === "Occupied" ? "border-red-400 bg-red-50" :
          st === "Reserved" ? "border-blue-400 bg-blue-50" :
          st === "Cleaning" ? "border-yellow-400 bg-yellow-50" : "border-gray-300 bg-gray-50"
        }`}>
          <span className="text-5xl">{bedEmoji(st)}</span>
          <span className="text-base font-bold text-slate-800">{String(d.bed_number ?? d.description)}</span>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${bedColor(st)} text-white`}>{st}</span>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex justify-between"><span className="font-medium">Type</span><span>{String(d.bed_type ?? "Standard")}</span></div>
          <div className="flex justify-between"><span className="font-medium">Charge</span><span>₹{String(d.charge ?? 0)}/day</span></div>
          <div className="flex justify-between"><span className="font-medium">Room</span><span>{String(d.room_name ?? "—")}</span></div>
          <div className="flex justify-between"><span className="font-medium">Ward</span><span>{String(d.ward_name ?? "—")}</span></div>
          {d.patient_name ? <div className="flex justify-between"><span className="font-medium">Patient</span><span className="text-red-600 font-semibold">{String(d.patient_name)}</span></div> : null}
        </div>
      </div>
    );
  }

  return null;
}


/* ─── Centre Panel: Dynamic Config Forms ─── */
function CentrePanel({
  selected, onSelect, hierarchy, hname, onRefresh, deptOptions, wardOptions,
  roomTypeOptions, roomPurposeOptions, bedTypeOptions,
}: {
  selected: SelectedNode | null; onSelect: (n: SelectedNode | null) => void;
  hierarchy: HierarchyData | null; hname: string; onRefresh: () => void;
  deptOptions: string[]; wardOptions: string[];
  roomTypeOptions: string[]; roomPurposeOptions: string[]; bedTypeOptions: string[];
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [selWards, setSelWards] = useState<string[]>([]);

  useEffect(() => {
    if (!selected) { setForm({}); return; }
    const d = selected.data;
    const initialForm: Record<string, string> = {};
    if (selected.type === "building") {
      initialForm.buildingName = String(d.building_name ?? "");
      initialForm.code = String(d.code ?? "");
      initialForm.description = String(d.description ?? "");
      initialForm.status = String(d.status ?? "Active");
      initialForm.floorCount = "4";
    } else if (selected.type === "floor") {
      initialForm.floorName = String(d.floor_name ?? "");
      initialForm.floorNumber = String(d.floor_number ?? "0");
      initialForm.deptToAdd = "";
    } else if (selected.type === "department") {
      initialForm.selectedWards = "";
    } else if (selected.type === "ward") {
      initialForm.wardType = String(d.ward_type ?? "");
      initialForm.status = String(d.status ?? "Active");
      initialForm.roomCount = "4";
      initialForm.roomType = "";
      initialForm.roomPurpose = "Patient Room";
      initialForm.capacity = "1";
      initialForm.rate = "0";
    } else if (selected.type === "room") {
      initialForm.description = String(d.description ?? "");
      initialForm.roomType = String(d.room_type ?? "");
      initialForm.roomPurpose = String(d.room_purpose ?? "Patient Room");
      initialForm.capacity = String(d.capacity ?? "1");
      initialForm.rate = String(d.rate ?? "0");
      initialForm.status = String(d.status ?? "Available");
      initialForm.bedCount = "4";
      initialForm.bedType = "Standard";
      initialForm.charge = "0";
    } else if (selected.type === "bed") {
      initialForm.bedNumber = String(d.bed_number ?? "");
      initialForm.bedType = String(d.bed_type ?? "Standard");
      initialForm.charge = String(d.charge ?? "0");
      initialForm.status = String(d.status ?? "Available");
      initialForm.description = String(d.description ?? "");
    }
    setForm(initialForm);
    setMsg(null);
  }, [selected?.id, selected?.type]);

  const f = (k: string) => form[k] ?? "";
  const sf = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function api(action: string, payload: Record<string, unknown>) {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await r.json() as Record<string, unknown>;
      if (!r.ok) throw new Error(String(data.error ?? "Request failed"));
      setMsg({ ok: true, text: "Saved successfully" });
      onRefresh();
      return data;
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
      return null;
    } finally { setSaving(false); }
  }

  /* ── No selection ── */
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="text-6xl">🏥</div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Hospital Infrastructure Builder</h2>
          <p className="text-sm text-slate-500">Select a node from the tree to configure it, or add a new building to get started.</p>
        </div>
        <ActionBtn label="+ Add Building" onClick={async () => {
          await api("generate", { config: { buildingCount: 1, floorsPerBuilding: 0, departmentsPerFloor: 0, wardsPerDepartment: 0, roomsPerWard: 0, bedsPerRoom: 0 } });
        }} />
      </div>
    );
  }

  const MsgBanner = () => msg ? (
    <div className={`rounded-lg px-3 py-2 text-xs font-medium ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
      {msg.text}
    </div>
  ) : null;

  /* ── Building Form ── */
  if (selected.type === "building") {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🏢</span>
          <h2 className="text-lg font-bold text-slate-800">Building Configuration</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Building Name" id="b-name" value={f("buildingName")} onChange={sf("buildingName")} />
          <InputField label="Building Code" id="b-code" value={f("code")} onChange={sf("code")} />
        </div>
        <InputField label="Description" id="b-desc" value={f("description")} onChange={sf("description")} />
        <SelectField label="Status" id="b-status" value={f("status")} onChange={sf("status")} options={["Active","Inactive","Under Construction"]} />
        <div className="flex gap-3 pt-2">
          <ActionBtn label="💾 Save Building" onClick={() => api("updateBuilding", { id: selected.id, buildingName: f("buildingName"), code: f("code"), description: f("description"), status: f("status") })} disabled={saving} />
          <ActionBtn label="🗑️ Delete" onClick={() => { if (confirm("Delete this building and all its contents?")) void api("deleteBuilding", { id: selected.id }).then(() => onSelect(null)); }} variant="danger" disabled={saving} />
          <ActionBtn label="📋 Duplicate" onClick={() => api("duplicateBuilding", { id: selected.id })} variant="ghost" disabled={saving} />
        </div>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Generate Floors</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1"><InputField label="Number of Floors" id="b-floors" value={f("floorCount")} onChange={sf("floorCount")} type="number" /></div>
            <ActionBtn label="🏗️ Generate Floors" variant="success" onClick={() => api("generateFloors", { buildingId: selected.id, floorCount: Number(f("floorCount")) })} disabled={saving || !f("floorCount")} />
          </div>
        </div>
        <MsgBanner />
      </div>
    );
  }

  /* ── Floor Form ── */
  if (selected.type === "floor") {
    const assignedDepts = (hierarchy?.floorDepartments ?? []).filter((d) => Number(d.floor_id) === selected.id);
    const unassigned = deptOptions.filter((d) => !assignedDepts.some((a) => a.department_name === d));
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🏗️</span><h2 className="text-lg font-bold text-slate-800">Floor Configuration</h2></div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Floor Name" id="fl-name" value={f("floorName")} onChange={sf("floorName")} />
          <InputField label="Floor Number" id="fl-num" value={f("floorNumber")} onChange={sf("floorNumber")} type="number" />
        </div>
        <div className="flex gap-3">
          <ActionBtn label="💾 Save Floor" onClick={() => api("updateFloor", { id: selected.id, floorName: f("floorName"), floorNumber: f("floorNumber") })} disabled={saving} />
          <ActionBtn label="🗑️ Delete Floor" onClick={() => { if (confirm("Delete this floor and all its contents?")) void api("deleteFloor", { id: selected.id }).then(() => onSelect(null)); }} variant="danger" disabled={saving} />
        </div>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Assigned Departments ({assignedDepts.length})</h3>
          <div className="flex flex-wrap gap-2">
            {assignedDepts.map((d) => (
              <span key={String(d.id)} className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
                🏥 {String(d.department_name)}
                <button type="button" className="ml-1 text-purple-500 hover:text-red-600" onClick={() => api("removeDepartment", { floorDeptId: d.id })}>×</button>
              </span>
            ))}
            {assignedDepts.length === 0 && <p className="text-xs text-slate-400">No departments assigned yet.</p>}
          </div>
          <h3 className="text-sm font-semibold text-slate-700 pt-2">Add Department</h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <SelectField label="" id="fl-dept" value={f("deptToAdd")} onChange={sf("deptToAdd")} options={unassigned} />
            </div>
            <ActionBtn label="+ Assign" variant="success" onClick={() => {
              const parts = f("deptToAdd").split(" - ");
              const deptName = f("deptToAdd");
              if (!deptName) return;
              const floor = hierarchy?.floors.find((fl) => Number(fl.id) === selected.id);
              const building = hierarchy?.buildings.find((b) => Number(b.id) === Number(floor?.building_id));
              void api("assignDepartment", {
                floorId: selected.id, floorName: f("floorName"),
                buildingId: Number(floor?.building_id ?? 0), buildingName: String(building?.building_name ?? ""),
                departmentId: 0, departmentName: parts.length > 1 ? parts.slice(1).join(" - ").trim() : deptName,
              });
            }} disabled={saving || !f("deptToAdd")} />
          </div>
        </div>
        <MsgBanner />
      </div>
    );
  }

  /* ── Department Form ── */
  if (selected.type === "department") {
    const existingWards = (hierarchy?.wardInstances ?? []).filter((w) => Number(w.floor_dept_assignment_id) === selected.id);
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🏥</span><h2 className="text-lg font-bold text-slate-800">Department Configuration</h2></div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 font-medium">{String(selected.data.department_name)}</div>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Existing Wards ({existingWards.length})</h3>
          <div className="flex flex-wrap gap-2">
            {existingWards.map((w) => (
              <span key={String(w.id)} className="flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800">
                🛏️ {String(w.ward_type)}
                <button type="button" className="ml-1 text-teal-500 hover:text-red-600" onClick={() => api("removeWard", { id: w.id })}>×</button>
              </span>
            ))}
            {existingWards.length === 0 && <p className="text-xs text-slate-400">No wards yet.</p>}
          </div>
          <h3 className="text-sm font-semibold text-slate-700 pt-2">Generate Wards</h3>
          <p className="text-xs text-slate-500">Select ward types to generate:</p>
          <div className="flex flex-wrap gap-2">
            {wardOptions.map((w) => (
              <button key={w} type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${selWards.includes(w) ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"}`}
                onClick={() => setSelWards((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w])}>
                {w}
              </button>
            ))}
            {wardOptions.length === 0 && <p className="text-xs text-slate-400">No ward types in master.</p>}
          </div>
          <ActionBtn label="🛏️ Generate Selected Wards" variant="success" onClick={() => api("generateWards", { floorDeptId: selected.id, wardTypes: selWards })} disabled={saving || selWards.length === 0} />
        </div>
        <ActionBtn label="🗑️ Remove Department" onClick={() => { if (confirm("Remove this department and all its wards/rooms/beds?")) void api("removeDepartment", { floorDeptId: selected.id }).then(() => onSelect(null)); }} variant="danger" disabled={saving} />
        <MsgBanner />
      </div>
    );
  }

  /* ── Ward Form ── */
  if (selected.type === "ward") {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🛏️</span><h2 className="text-lg font-bold text-slate-800">Ward Configuration</h2></div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Ward Type / Name" id="w-type" value={f("wardType")} onChange={sf("wardType")} />
          <SelectField label="Status" id="w-status" value={f("status")} onChange={sf("status")} options={["Active","Inactive"]} />
        </div>
        <div className="flex gap-3">
          <ActionBtn label="💾 Save Ward" onClick={() => api("updateWard", { id: selected.id, wardType: f("wardType"), status: f("status") })} disabled={saving} />
          <ActionBtn label="🗑️ Delete Ward" onClick={() => { if (confirm("Delete this ward and all its rooms/beds?")) void api("removeWard", { id: selected.id }).then(() => onSelect(null)); }} variant="danger" disabled={saving} />
        </div>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Generate Rooms</h3>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Number of Rooms" id="w-rcount" value={f("roomCount")} onChange={sf("roomCount")} type="number" />
            <SelectField label="Room Type" id="w-rtype" value={f("roomType")} onChange={sf("roomType")} options={roomTypeOptions} />
            <SelectField label="Room Purpose" id="w-rpurpose" value={f("roomPurpose")} onChange={sf("roomPurpose")} options={roomPurposeOptions.length ? roomPurposeOptions : ["Patient Room","Isolation","Procedure"]} />
            <InputField label="Capacity (beds/room)" id="w-cap" value={f("capacity")} onChange={sf("capacity")} type="number" />
          </div>
          <ActionBtn label="🚪 Generate Rooms" variant="success" onClick={() => api("generateRooms", { wardId: selected.id, roomCount: Number(f("roomCount")), roomType: f("roomType"), roomPurpose: f("roomPurpose"), capacity: Number(f("capacity")), rate: Number(f("rate")) })} disabled={saving || !f("roomCount")} />
        </div>
        <MsgBanner />
      </div>
    );
  }

  /* ── Room Form ── */
  if (selected.type === "room") {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🚪</span><h2 className="text-lg font-bold text-slate-800">Room Configuration</h2></div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Room Number / Name" id="r-desc" value={f("description")} onChange={sf("description")} />
          <SelectField label="Status" id="r-status" value={f("status")} onChange={sf("status")} options={["Available","Partially Occupied","Full","Maintenance"]} />
          <SelectField label="Room Type" id="r-type" value={f("roomType")} onChange={sf("roomType")} options={roomTypeOptions} />
          <SelectField label="Room Purpose" id="r-purpose" value={f("roomPurpose")} onChange={sf("roomPurpose")} options={roomPurposeOptions.length ? roomPurposeOptions : ["Patient Room","Isolation","Procedure"]} />
          <InputField label="Capacity" id="r-cap" value={f("capacity")} onChange={sf("capacity")} type="number" />
          <InputField label="Rate (₹/day)" id="r-rate" value={f("rate")} onChange={sf("rate")} type="number" />
        </div>
        <div className="flex gap-3">
          <ActionBtn label="💾 Save Room" onClick={() => api("updateRoom", { id: selected.id, description: f("description"), roomType: f("roomType"), roomPurpose: f("roomPurpose"), capacity: Number(f("capacity")), rate: Number(f("rate")), status: f("status") })} disabled={saving} />
          <ActionBtn label="🗑️ Delete Room" onClick={() => { if (confirm("Delete this room and all its beds?")) void api("deleteRoom", { id: selected.id }).then(() => onSelect(null)); }} variant="danger" disabled={saving} />
        </div>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Generate Beds</h3>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Number of Beds" id="r-bcount" value={f("bedCount")} onChange={sf("bedCount")} type="number" />
            <SelectField label="Bed Type" id="r-btype" value={f("bedType")} onChange={sf("bedType")} options={bedTypeOptions.length ? bedTypeOptions : ["Standard","ICU Bed","Pediatric Bed"]} />
            <InputField label="Charge (₹/day)" id="r-bcharge" value={f("charge")} onChange={sf("charge")} type="number" />
          </div>
          <ActionBtn label="🛌 Generate Beds" variant="success" onClick={() => api("generateBeds", { roomId: selected.id, bedCount: Number(f("bedCount")), bedType: f("bedType"), charge: Number(f("charge")) })} disabled={saving || !f("bedCount")} />
        </div>
        <MsgBanner />
      </div>
    );
  }

  /* ── Bed Form ── */
  if (selected.type === "bed") {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🛌</span><h2 className="text-lg font-bold text-slate-800">Bed Configuration</h2></div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bed Number" id="bed-num" value={f("bedNumber")} onChange={sf("bedNumber")} />
          <SelectField label="Bed Type" id="bed-type" value={f("bedType")} onChange={sf("bedType")} options={bedTypeOptions.length ? bedTypeOptions : ["Standard","ICU Bed","Pediatric Bed","Bariatric Bed"]} />
          <InputField label="Charge (₹/day)" id="bed-charge" value={f("charge")} onChange={sf("charge")} type="number" />
          <SelectField label="Status" id="bed-status" value={f("status")} onChange={sf("status")} options={["Available","Occupied","Reserved","Cleaning","Maintenance","Blocked"]} />
        </div>
        <InputField label="Description" id="bed-desc" value={f("description")} onChange={sf("description")} />
        <div className="flex gap-3">
          <ActionBtn label="💾 Save Bed" onClick={() => api("updateBed", { id: selected.id, bedNumber: f("bedNumber"), bedType: f("bedType"), charge: Number(f("charge")), status: f("status"), description: f("description") })} disabled={saving} />
          <ActionBtn label="🗑️ Delete Bed" onClick={() => { if (confirm("Delete this bed?")) void api("deleteBed", { id: selected.id }).then(() => onSelect(null)); }} variant="danger" disabled={saving} />
        </div>
        <MsgBanner />
      </div>
    );
  }

  return null;
}


/* ─── Main Page ─── */
export default function InfrastructureBuilderPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [search, setSearch] = useState("");

  // LOV options
  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
  const [roomPurposeOptions, setRoomPurposeOptions] = useState<string[]>([]);
  const [bedTypeOptions, setBedTypeOptions] = useState<string[]>([]);

  const loadHierarchy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=hierarchy`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as HierarchyData;
      setHierarchy(data);
    } finally { setLoading(false); }
  }, [hname]);

  useEffect(() => { if (hname) void loadHierarchy(); }, [hname, loadHierarchy]);

  useEffect(() => {
    if (!hname) return;
    async function loadLov(table: string, setter: (v: string[]) => void) {
      try {
        const r = await fetch(`/api/${hname}/forms/${table}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json() as { rows?: Rec[] };
        const opts = (d.rows ?? []).map((row) => {
          const code = String(row.code ?? "").trim();
          const desc = String(row.description ?? row.department_type ?? row.ward_type ?? "").trim();
          if (!code) return "";
          return desc ? `${code} - ${desc}` : code;
        }).filter(Boolean);
        setter(opts);
      } catch { /* ignore */ }
    }
    async function loadBedTypes() {
      try {
        const r = await fetch(`/api/${hname}/forms/bed_master`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json() as { rows?: Rec[] };
        const seen = new Set<string>(); const types: string[] = [];
        for (const row of (d.rows ?? [])) {
          const bt = String(row.bed_type ?? "").trim();
          if (bt && !seen.has(bt)) { seen.add(bt); types.push(bt); }
        }
        setBedTypeOptions(types);
      } catch { /* ignore */ }
    }
    void loadLov("department_master", setDeptOptions);
    void loadLov("ward_master", setWardOptions);
    void loadLov("room_type_master", setRoomTypeOptions);
    void loadLov("room_purpose_master", setRoomPurposeOptions);
    void loadBedTypes();
  }, [hname]);

  /* ── Breadcrumb ── */
  function breadcrumb() {
    if (!selected) return [];
    const crumbs: string[] = [];
    const d = selected.data;
    if (d.building_name) crumbs.push(String(d.building_name));
    if (selected.type !== "building" && d.floor_name) crumbs.push(String(d.floor_name));
    if (selected.type !== "building" && selected.type !== "floor" && d.department_name) crumbs.push(String(d.department_name));
    if (selected.type === "ward" || selected.type === "room" || selected.type === "bed") {
      if (d.ward_type ?? d.ward_name) crumbs.push(String(d.ward_type ?? d.ward_name));
    }
    if (selected.type === "room" || selected.type === "bed") crumbs.push(String(d.description ?? d.code ?? "Room"));
    if (selected.type === "bed") crumbs.push(String(d.bed_number ?? "Bed"));
    return crumbs;
  }

  /* ── Stats ── */
  const stats = hierarchy ? {
    buildings: hierarchy.buildings.length,
    floors: hierarchy.floors.length,
    departments: hierarchy.floorDepartments.length,
    wards: hierarchy.wardInstances.length,
    rooms: hierarchy.rooms.length,
    beds: hierarchy.beds.length,
    occupied: hierarchy.beds.filter((b) => b.status === "Occupied").length,
  } : null;

  const occupancy = stats && stats.beds > 0 ? Math.round((stats.occupied / stats.beds) * 100) : 0;

  /* ── Search filter ── */
  const sq = search.toLowerCase();
  const filteredBuildings = hierarchy?.buildings.filter((b) =>
    !sq || String(b.building_name).toLowerCase().includes(sq) || String(b.code ?? "").toLowerCase().includes(sq)
  ) ?? [];

  /* ── Tree render ── */
  function renderTree() {
    if (loading) return <div className="p-4 text-xs text-slate-400 animate-pulse">Loading hierarchy…</div>;
    if (!hierarchy || hierarchy.buildings.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="text-4xl">🏗️</span>
          <p className="text-xs text-slate-500">No infrastructure yet.<br/>Use the centre panel to add a building.</p>
          <button type="button" className="text-xs font-semibold text-blue-600 hover:underline" onClick={() => setSelected(null)}>+ Add Building</button>
        </div>
      );
    }

    return (
      <div className="py-2 px-1 space-y-0.5">
        {filteredBuildings.map((building) => {
          const bId = Number(building.id);
          const bFloors = hierarchy.floors.filter((f) => Number(f.building_id) === bId);
          return (
            <TreeNode
              key={String(building.id)}
              icon="🏢" label={String(building.building_name ?? building.code)}
              nodeId={`b-${building.id}`}
              selected={selected?.type === "building" && selected.id === bId}
              onSelect={() => setSelected({ type: "building", id: bId, data: building })}
              onEdit={() => setSelected({ type: "building", id: bId, data: building })}
              onDelete={() => { if (confirm("Delete building?")) void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteBuilding", id: bId }) }).then(() => { void loadHierarchy(); setSelected(null); }); }}
              onDuplicate={() => void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicateBuilding", id: bId }) }).then(() => void loadHierarchy())}
              onAdd={() => setSelected({ type: "building", id: bId, data: building })}
              defaultOpen level={0}
            >
              {bFloors.map((floor) => {
                const fId = Number(floor.id);
                const fDepts = hierarchy.floorDepartments.filter((d) => Number(d.floor_id) === fId);
                return (
                  <TreeNode
                    key={String(floor.id)}
                    icon="🏗️" label={String(floor.floor_name)}
                    nodeId={`f-${floor.id}`}
                    selected={selected?.type === "floor" && selected.id === fId}
                    onSelect={() => setSelected({ type: "floor", id: fId, data: floor })}
                    onEdit={() => setSelected({ type: "floor", id: fId, data: floor })}
                    onDelete={() => { if (confirm("Delete floor?")) void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteFloor", id: fId }) }).then(() => { void loadHierarchy(); setSelected(null); }); }}
                    onAdd={() => setSelected({ type: "floor", id: fId, data: floor })}
                    level={1}
                  >
                    {fDepts.map((dept) => {
                      const dId = Number(dept.id);
                      const dWards = hierarchy.wardInstances.filter((w) => Number(w.floor_dept_assignment_id) === dId);
                      return (
                        <TreeNode
                          key={String(dept.id)}
                          icon="🏥" label={String(dept.department_name)}
                          nodeId={`d-${dept.id}`}
                          selected={selected?.type === "department" && selected.id === dId}
                          onSelect={() => setSelected({ type: "department", id: dId, data: dept })}
                          onEdit={() => setSelected({ type: "department", id: dId, data: dept })}
                          onDelete={() => { if (confirm("Remove department?")) void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "removeDepartment", floorDeptId: dId }) }).then(() => { void loadHierarchy(); setSelected(null); }); }}
                          onAdd={() => setSelected({ type: "department", id: dId, data: dept })}
                          level={2}
                        >
                          {dWards.map((ward) => {
                            const wId = Number(ward.id);
                            const wRooms = hierarchy.rooms.filter((r) => Number(r.ward_instance_id) === wId);
                            return (
                              <TreeNode
                                key={String(ward.id)}
                                icon="🛏️" label={String(ward.ward_type)}
                                nodeId={`w-${ward.id}`}
                                selected={selected?.type === "ward" && selected.id === wId}
                                onSelect={() => setSelected({ type: "ward", id: wId, data: ward })}
                                onEdit={() => setSelected({ type: "ward", id: wId, data: ward })}
                                onDelete={() => { if (confirm("Delete ward?")) void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "removeWard", id: wId }) }).then(() => { void loadHierarchy(); setSelected(null); }); }}
                                onAdd={() => setSelected({ type: "ward", id: wId, data: ward })}
                                level={3}
                              >
                                {wRooms.map((room) => {
                                  const rId = Number(room.id);
                                  const rBeds = hierarchy.beds.filter((b) => Number(b.room_id) === rId);
                                  return (
                                    <TreeNode
                                      key={String(room.id)}
                                      icon="🚪" label={String(room.description ?? room.code)}
                                      nodeId={`r-${room.id}`}
                                      selected={selected?.type === "room" && selected.id === rId}
                                      onSelect={() => setSelected({ type: "room", id: rId, data: room })}
                                      onEdit={() => setSelected({ type: "room", id: rId, data: room })}
                                      onDelete={() => { if (confirm("Delete room?")) void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteRoom", id: rId }) }).then(() => { void loadHierarchy(); setSelected(null); }); }}
                                      onAdd={() => setSelected({ type: "room", id: rId, data: room })}
                                      level={4}
                                    >
                                      {rBeds.map((bed) => {
                                        const bedId = Number(bed.id);
                                        return (
                                          <TreeNode
                                            key={String(bed.id)}
                                            icon={bedEmoji(String(bed.status))}
                                            label={String(bed.bed_number ?? bed.description)}
                                            nodeId={`bed-${bed.id}`}
                                            selected={selected?.type === "bed" && selected.id === bedId}
                                            onSelect={() => setSelected({ type: "bed", id: bedId, data: bed })}
                                            onEdit={() => setSelected({ type: "bed", id: bedId, data: bed })}
                                            onDelete={() => { if (confirm("Delete bed?")) void fetch(`/api/${hname}/infrastructure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteBed", id: bedId }) }).then(() => { void loadHierarchy(); setSelected(null); }); }}
                                            level={5}
                                          />
                                        );
                                      })}
                                    </TreeNode>
                                  );
                                })}
                              </TreeNode>
                            );
                          })}
                        </TreeNode>
                      );
                    })}
                  </TreeNode>
                );
              })}
            </TreeNode>
          );
        })}
      </div>
    );
  }

  const crumbs = breadcrumb();

  return (
    <PageLayout title="Infrastructure Builder">
      <div className="flex flex-col gap-4 h-full">
        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            <StatCard label="Buildings" value={stats.buildings} icon="🏢" />
            <StatCard label="Floors" value={stats.floors} icon="🏗️" />
            <StatCard label="Departments" value={stats.departments} icon="🏥" />
            <StatCard label="Wards" value={stats.wards} icon="🛏️" />
            <StatCard label="Rooms" value={stats.rooms} icon="🚪" />
            <StatCard label="Beds" value={stats.beds} icon="🛌" />
            <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <span className="text-lg">📊</span>
              <span className="text-xl font-bold text-orange-600">{occupancy}%</span>
              <span className="text-[11px] text-slate-500">Occupancy</span>
            </div>
          </div>
        )}

        {/* Three-panel layout */}
        <div className="flex gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" style={{ minHeight: "72vh" }}>

          {/* LEFT: Tree Panel */}
          <div className="w-72 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50">
            <div className="border-b border-slate-100 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Infrastructure</span>
                <button type="button" onClick={() => void loadHierarchy()} className="text-blue-500 hover:text-blue-700 text-xs font-semibold">↻ Refresh</button>
              </div>
              <input
                type="search" placeholder="🔍 Search nodes…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderTree()}
            </div>
            <div className="border-t border-slate-100 p-3">
              <button type="button"
                className="w-full rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                onClick={() => setSelected(null)}>
                + Add New Building
              </button>
            </div>
          </div>

          {/* CENTRE: Config Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Breadcrumb */}
            {crumbs.length > 0 && (
              <div className="border-b border-slate-100 px-6 py-2.5 flex items-center gap-1 text-xs text-slate-500">
                <span className="text-slate-400">🏥</span>
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-300">›</span>}
                    <span className={i === crumbs.length - 1 ? "font-semibold text-blue-700" : ""}>{c}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <CentrePanel
                selected={selected} onSelect={setSelected}
                hierarchy={hierarchy} hname={hname} onRefresh={loadHierarchy}
                deptOptions={deptOptions} wardOptions={wardOptions}
                roomTypeOptions={roomTypeOptions} roomPurposeOptions={roomPurposeOptions}
                bedTypeOptions={bedTypeOptions}
              />
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className="w-80 shrink-0 border-l border-slate-100 flex flex-col bg-slate-50">
            <div className="border-b border-slate-100 px-4 py-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Live Preview</span>
              {selected && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs">{NODE_ICON[selected.type]}</span>
                  <span className="text-xs text-slate-500 font-medium capitalize">{selected.type}</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <LivePreview selected={selected} hierarchy={hierarchy} />
            </div>
            {/* Legend */}
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Bed Status Legend</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[["🟢","Available"],["🔴","Occupied"],["🔵","Reserved"],["🟡","Cleaning"],["⬜","Maintenance"]].map(([e,l]) => (
                  <div key={l} className="flex items-center gap-1.5 text-[10px] text-slate-600"><span>{e}</span><span>{l}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
