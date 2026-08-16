"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { getCurrentUser } from "../../../../app/actions/user";
import { useHospitalTimezone } from "../../../../components/context/HospitalTimezoneContext";

interface CarePlanItem {
    id: string; // generated as time-description
    time: string;
    ampm: string;
    description: string;
    frequency: string;
    startDate: string;
}

interface ConsultationCarePlan {
    consultation_id: number;
    patient_id: string;
    patient_name: string;
    care_plans: string; // JSON string
    rno: string | null;
    bed_name: string | null;
    ward_name: string | null;
    room_name: string | null;
    floor_name: string | null;
    building_name: string | null;
}

interface ExecutionLog {
    id: number;
    patient_id: string;
    patient_name: string;
    consultation_id: number;
    care_plan_id: string;
    executed_at: string;
    executed_by: string;
    remarks: string;
    height_cm?: number;
    weight_kg?: number;
    temperature?: number;
    pulse_rate?: number;
    respiratory_rate?: number;
    systolic_bp?: number;
    diastolic_bp?: number;
    spo2?: number;
    blood_sugar?: number;
    bmi?: number;
}

interface FlatCarePlan {
    consultation_id: number;
    patient_id: string;
    patient_name: string;
    bed_label: string;
    item: CarePlanItem;
    execution?: ExecutionLog;
}

export default function CarePlanDashboardPage() {
    const params = useParams();
    const hname = params?.Hname as string;

    const { todayDate: tzTodayDate } = useHospitalTimezone();
    const [targetDate, setTargetDate] = useState<string>("");
    const [currentUser, setCurrentUser] = useState<string>("");

    // Filters
    const [selectedFrequency, setSelectedFrequency] = useState<string>("All");

    // Data state
    const [data, setData] = useState<{
        consultations: ConsultationCarePlan[];
        executions: ExecutionLog[];
    }>({ consultations: [], executions: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Execution overlay modal state
    const [activePlan, setActivePlan] = useState<FlatCarePlan | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    // Vitals form fields
    const [heightCm, setHeightCm] = useState("");
    const [weightKg, setWeightKg] = useState("");
    const [temperature, setTemperature] = useState("");
    const [pulseRate, setPulseRate] = useState("");
    const [respiratoryRate, setRespiratoryRate] = useState("");
    const [systolicBp, setSystolicBp] = useState("");
    const [diastolicBp, setDiastolicBp] = useState("");
    const [spo2, setSpo2] = useState("");
    const [bloodSugar, setBloodSugar] = useState("");
    const [bmi, setBmi] = useState("");
    const [remarks, setRemarks] = useState("");
    const [executedBy, setExecutedBy] = useState("");

    // Set default date when context loads
    useEffect(() => {
        if (tzTodayDate) {
            setTargetDate(tzTodayDate);
        } else {
            setTargetDate(new Date().toISOString().split("T")[0]);
        }
    }, [tzTodayDate]);

    // Load current user details
    useEffect(() => {
        if (!hname) return;
        getCurrentUser(hname)
            .then((user) => {
                if (user) {
                    setCurrentUser(user);
                    setExecutedBy(user);
                }
            })
            .catch(() => { });
    }, [hname]);

    // Calculate BMI dynamically
    useEffect(() => {
        const w = parseFloat(weightKg);
        const h = parseFloat(heightCm);
        if (!isNaN(w) && !isNaN(h) && h > 0) {
            const hM = h / 100;
            const computedBmi = (w / (hM * hM)).toFixed(2);
            setBmi(computedBmi);
        } else {
            setBmi("");
        }
    }, [weightKg, heightCm]);

    const loadData = useCallback(async () => {
        if (!hname || !targetDate) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/${encodeURIComponent(hname)}/infrastructure?action=care_plans&date=${targetDate}`,
                { cache: "no-store" }
            );
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || "Failed to fetch care plans.");
            setData(resData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data.");
        } finally {
            setIsLoading(false);
        }
    }, [hname, targetDate]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    // Transform raw consultations and executions into a flat view of care plan items scheduled
    const getFlatCarePlans = (): FlatCarePlan[] => {
        const list: FlatCarePlan[] = [];

        data.consultations.forEach((con) => {
            let plans: CarePlanItem[] = [];
            try {
                const parsed = JSON.parse(con.care_plans);
                if (Array.isArray(parsed)) {
                    plans = parsed.map((p, idx): CarePlanItem => {
                        // Generate id if missing
                        const timeStr = String(p.time || "08:00");
                        const ampmStr = String(p.ampm || "AM");
                        const desc = String(p.description || "");
                        const freq = String(p.frequency || "Daily");
                        return {
                            id: p.id || `${timeStr}-${ampmStr}-${idx}`,
                            time: timeStr,
                            ampm: ampmStr,
                            description: desc,
                            frequency: freq,
                            startDate: p.startDate || con.rno || ""
                        };
                    });
                }
            } catch {
                plans = [];
            }

            const bedLabel = con.rno
                ? `${con.bed_name || con.rno} (${con.ward_name || "General Ward"})`
                : "No Bed Allocated";

            plans.forEach((plan) => {
                // Find if this plan was executed today
                const execution = data.executions.find(
                    (ex) =>
                        ex.consultation_id === con.consultation_id &&
                        ex.care_plan_id === plan.id
                );

                list.push({
                    consultation_id: con.consultation_id,
                    patient_id: con.patient_id,
                    patient_name: con.patient_name,
                    bed_label: bedLabel,
                    item: plan,
                    execution
                });
            });
        });

        // Apply frequency filter
        let filtered = list;
        if (selectedFrequency !== "All") {
            filtered = list.filter((p) => p.item.frequency === selectedFrequency);
        }

        // Sort by scheduled time
        return filtered.sort((a, b) => {
            const getMinutes = (p: CarePlanItem) => {
                const parts = p.time.split(":");
                let hrs = parseInt(parts[0] || "0");
                const mins = parseInt(parts[1] || "0");
                const isPM = p.ampm.toUpperCase() === "PM";
                if (isPM && hrs < 12) hrs += 12;
                if (!isPM && hrs === 12) hrs = 0;
                return hrs * 60 + mins;
            };
            return getMinutes(a.item) - getMinutes(b.item);
        });
    };

    const handleOpenExecution = (plan: FlatCarePlan) => {
        setActivePlan(plan);
        setHeightCm("");
        setWeightKg("");
        setTemperature("");
        setPulseRate("");
        setRespiratoryRate("");
        setSystolicBp("");
        setDiastolicBp("");
        setSpo2("");
        setBloodSugar("");
        setBmi("");
        setRemarks("");
        setExecutedBy(currentUser || "");
    };

    const handleSubmitExecution = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hname || !activePlan) return;

        setIsExecuting(true);
        try {
            const payload = {
                action: "execute_care_plan",
                patientId: activePlan.patient_id,
                patientName: activePlan.patient_name,
                consultationId: activePlan.consultation_id,
                carePlanId: activePlan.item.id,
                executedBy,
                remarks,
                heightCm: heightCm || null,
                weightKg: weightKg || null,
                temperature: temperature || null,
                pulseRate: pulseRate || null,
                respiratoryRate: respiratoryRate || null,
                systolicBp: systolicBp || null,
                diastolicBp: diastolicBp || null,
                spo2: spo2 || null,
                bloodSugar: bloodSugar || null,
                bmi: bmi || null,
            };

            const res = await fetch(`/api/${encodeURIComponent(hname)}/infrastructure`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || "Execution save failed.");

            setActivePlan(null);
            void loadData();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to record execution.");
        } finally {
            setIsExecuting(false);
        }
    };

    const flatPlans = getFlatCarePlans();

    return (
        <PageLayout title="Inpatient Care Plan Execution Board">
            <div className="space-y-6">
                {/* Header toolbar */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                                Daily Care & Vitals Entry
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Track clinical task schedules, log vitals directly to electronic records, and audit remarks.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Target Date</label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Task Frequency</label>
                                <select
                                    value={selectedFrequency}
                                    onChange={(e) => setSelectedFrequency(e.target.value)}
                                    className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                    <option value="All">All Frequencies</option>
                                    <option value="Daily">Daily</option>
                                    <option value="Twice Daily">Twice Daily (BID)</option>
                                    <option value="Thrice Daily">Thrice Daily (TID)</option>
                                    <option value="Every 4 Hours">Every 4 Hours</option>
                                    <option value="Every 6 Hours">Every 6 Hours</option>
                                    <option value="Every 8 Hours">Every 8 Hours</option>
                                    <option value="Every 12 Hours">Every 12 Hours</option>
                                    <option value="As Needed (PRN)">As Needed (PRN)</option>
                                    <option value="Once Weekly">Once Weekly</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">⚠️ {error}</p>
                    </div>
                )}

                {/* Dashboard Schedule List */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white-90">
                            Care Schedules ({flatPlans.length})
                        </h3>
                        <span className="text-xs text-gray-400">Times sorted chronologically</span>
                    </div>

                    <div className="p-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                                <span className="ml-3 text-sm text-gray-500">Loading schedules...</span>
                            </div>
                        ) : flatPlans.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No active care plan elements matched the selected day and filters.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {flatPlans.map((plan, idx) => {
                                    const isExecuted = !!plan.execution;

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border transition gap-4 ${isExecuted
                                                    ? "border-green-100 bg-green-50/20 dark:border-green-800/20 dark:bg-green-950/5"
                                                    : "border-gray-200 bg-gray-50/20 dark:border-gray-800 dark:bg-transparent"
                                                }`}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded">
                                                        🕒 {plan.item.time} {plan.item.ampm}
                                                    </span>
                                                    <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/30 px-2 py-0.5 rounded">
                                                        {plan.item.frequency}
                                                    </span>
                                                    {isExecuted && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2.5 py-0.5 rounded-full">
                                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Executed
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                    {plan.patient_name}{" "}
                                                    <span className="text-xs font-mono text-gray-400">({plan.patient_id})</span>
                                                </h4>

                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    🛌 Bed: <strong className="text-gray-700 dark:text-gray-300">{plan.bed_label}</strong>
                                                </p>

                                                <div className="pt-1.5 text-sm text-gray-700 dark:text-gray-300 font-medium">
                                                    Instructions: <span className="font-normal italic">{plan.item.description}</span>
                                                </div>

                                                {isExecuted && plan.execution && (
                                                    <div className="mt-2 text-xs bg-green-100/30 dark:bg-green-950/10 p-3 rounded-lg border border-green-200/20 space-y-1 text-gray-600 dark:text-gray-400">
                                                        <div><strong>Remark:</strong> {plan.execution.remarks || "No comments"}</div>
                                                        <div>
                                                            <strong>Vitals recorded:</strong>{" "}
                                                            {[
                                                                plan.execution.temperature ? `Temp: ${plan.execution.temperature}°F` : "",
                                                                plan.execution.pulse_rate ? `Pulse: ${plan.execution.pulse_rate} bpm` : "",
                                                                plan.execution.respiratory_rate ? `RR: ${plan.execution.respiratory_rate}` : "",
                                                                plan.execution.systolic_bp || plan.execution.diastolic_bp
                                                                    ? `BP: ${plan.execution.systolic_bp}/${plan.execution.diastolic_bp}`
                                                                    : "",
                                                                plan.execution.spo2 ? `SpO2: ${plan.execution.spo2}%` : "",
                                                                plan.execution.blood_sugar ? `Sugar: ${plan.execution.blood_sugar} mg/dL` : "",
                                                                plan.execution.bmi ? `BMI: ${plan.execution.bmi}` : "",
                                                            ]
                                                                .filter(Boolean)
                                                                .join(", ") || "None"}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            Logged by {plan.execution.executed_by} at {new Date(plan.execution.executed_at).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {!isExecuted && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenExecution(plan)}
                                                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow transition"
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                    </svg>
                                                    Execute Plan
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Fullscreen Execution Overlay Modal */}
                {activePlan && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-fadeIn">
                        <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4 bg-gray-50/50 dark:bg-gray-900/40">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        Execute Care Plan element
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        For patient: <strong className="text-gray-700 dark:text-gray-200">{activePlan.patient_name}</strong> ({activePlan.patient_id})
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActivePlan(null)}
                                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 transition"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Form Body */}
                            <form onSubmit={handleSubmitExecution} className="flex-1 overflow-y-auto p-6 space-y-5">
                                {/* Instruction Summary */}
                                <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-4 dark:border-purple-900/20 dark:bg-purple-950/5 space-y-1">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                                        <span>🕒 {activePlan.item.time} {activePlan.item.ampm}</span>
                                        <span>•</span>
                                        <span>{activePlan.item.frequency}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                        "{activePlan.item.description}"
                                    </p>
                                </div>

                                {/* Vitals fields */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Clinical Vitals Logging
                                    </h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Temperature (°F)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={temperature}
                                                onChange={(e) => setTemperature(e.target.value)}
                                                placeholder="e.g. 98.6"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Pulse Rate (bpm)
                                            </label>
                                            <input
                                                type="number"
                                                value={pulseRate}
                                                onChange={(e) => setPulseRate(e.target.value)}
                                                placeholder="e.g. 72"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Resp Rate (cpm)
                                            </label>
                                            <input
                                                type="number"
                                                value={respiratoryRate}
                                                onChange={(e) => setRespiratoryRate(e.target.value)}
                                                placeholder="e.g. 16"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                BP Systolic (mmHg)
                                            </label>
                                            <input
                                                type="number"
                                                value={systolicBp}
                                                onChange={(e) => setSystolicBp(e.target.value)}
                                                placeholder="e.g. 120"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                BP Diastolic (mmHg)
                                            </label>
                                            <input
                                                type="number"
                                                value={diastolicBp}
                                                onChange={(e) => setDiastolicBp(e.target.value)}
                                                placeholder="e.g. 80"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                SpO2 Oxygen (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={spo2}
                                                onChange={(e) => setSpo2(e.target.value)}
                                                placeholder="e.g. 98"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Sugar (mg/dL)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={bloodSugar}
                                                onChange={(e) => setBloodSugar(e.target.value)}
                                                placeholder="e.g. 110"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Height (cm)
                                            </label>
                                            <input
                                                type="number"
                                                value={heightCm}
                                                onChange={(e) => setHeightCm(e.target.value)}
                                                placeholder="e.g. 170"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Weight (kg)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={weightKg}
                                                onChange={(e) => setWeightKg(e.target.value)}
                                                placeholder="e.g. 68"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>

                                        {bmi && (
                                            <div className="col-span-2 sm:col-span-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg flex items-center justify-between border border-gray-200/50">
                                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Computed Body Mass Index (BMI):</span>
                                                <span className="font-mono text-sm font-extrabold text-brand-600 dark:text-brand-400">{bmi} kg/m²</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Remarks & Logs info */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Execution Remarks / Nurse Comments
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            placeholder="Enter details on treatment response, symptoms observed, or dosage administered..."
                                            className="w-full rounded-lg border border-gray-200 bg-transparent p-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Clinical Staff Signature Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={executedBy}
                                                onChange={(e) => setExecutedBy(e.target.value)}
                                                placeholder="Nurse / Practitioner Name"
                                                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setActivePlan(null)}
                                        className="h-11 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isExecuting}
                                        className="h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm transition"
                                    >
                                        {isExecuting ? "Saving Log..." : "Log Execution"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </PageLayout>
    );
}
