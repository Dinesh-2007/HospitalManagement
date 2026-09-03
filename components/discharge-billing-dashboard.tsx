"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useHospitalTimezone } from "./context/HospitalTimezoneContext";
import { useHospitalCurrency } from "./context/HospitalCurrencyContext";

type InvoiceRecord = {
  id: number;
  invoice_number: string;
  patient_name: string;
  patient_phone?: string;
  patient_id?: string;
  token_number: string;
  billing_type: string;
  subtotal: string | number;
  tax_amount?: string | number;
  discount_amount?: string | number;
  payable_amount: string | number;
  payment_status: string;
  payment_method?: string;
  transaction_id?: string;
  doctor_name?: string;
  details?: string;
  remarks?: string;
  created_at: string;
};

type PendingDischarge = {
  id: number;
  patient_name: string;
  patient_phone?: string;
  patient_id?: string;
  bed_name?: string;
  room_name?: string;
  ward_name?: string;
  floor_name?: string;
  building_name?: string;
  allocated_at?: string;
  discharged_at?: string;
  billing_amount?: string | number;
  created_at?: string;
};

function formatDisplayDate(dateValue: string | Date | undefined, includeTime = false): string {
  if (!dateValue) return "—";
  try {
    const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", includeTime ? {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    } : {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "—";
  }
}

export function DischargeBillingDashboard() {
  const params = useParams();
  const hname = decodeURIComponent(params?.Hname as string || "HSMS");

  const { todayDate } = useHospitalTimezone();
  const { formatCurrency, currencySymbol } = useHospitalCurrency();

  const [pendingDischarges, setPendingDischarges] = useState<PendingDischarge[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Views & filters
  const [activeTab, setActiveTab] = useState<"unbilled" | "invoices">("unbilled");
  const [selectedDate, setSelectedDate] = useState(() => todayDate);

  // Selection states
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Checkout modals
  const [activeCheckout, setActiveCheckout] = useState<PendingDischarge | null>(null);
  const [payingDraft, setPayingDraft] = useState<InvoiceRecord | null>(null);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<InvoiceRecord | null>(null);

  // Input states
  const [billingRemarks, setBillingRemarks] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment gateway input states
  const [paymentMethod, setPaymentMethod] = useState<"Card" | "UPI" | "Cash" | "Insurance">("Cash");
  const [transactionId, setTransactionId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const pendingRes = await fetch(`/api/${encodeURIComponent(hname)}/billing?action=pending`);
      const pendingData = await pendingRes.json();
      if (!pendingRes.ok) throw new Error(pendingData.error || "Failed to load pending lists");
      setPendingDischarges(pendingData.pendingDischarges || []);

      const invRes = await fetch(`/api/${encodeURIComponent(hname)}/billing${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`);
      const invData = await invRes.json();
      if (!invRes.ok) throw new Error(invData.error || "Failed to load invoices");
      const disInvoices = (invData.invoices || []).filter((i: InvoiceRecord) => i.billing_type === "Discharge");
      setInvoices(disInvoices);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hname) void loadData();
  }, [hname]);

  // Filtered invoices by selected date
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (searchQuery.trim().length > 0) return true; // Ignore date filter if searching
      const invDate = inv.created_at ? inv.created_at.slice(0, 10) : "";
      return invDate === selectedDate;
    });
  }, [invoices, selectedDate, searchQuery]);

  // Open billing creation for room discharge
  const handleOpenBilling = (d: PendingDischarge) => {
    setActiveCheckout(d);
    setPaymentMethod("Cash");
    setTransactionId("");
    setBillingRemarks("");
  };

  // Calculations for Discharge Invoice
  const billingCalculations = useMemo(() => {
    if (!activeCheckout) return { subtotal: 0, payable: 0 };
    const subtotal = Number(activeCheckout.billing_amount || 0);
    return {
      subtotal,
      payable: subtotal
    };
  }, [activeCheckout]);

  // Submit and finalize invoice
  const handleFinalizeInvoice = async (status: "Paid" | "Pending") => {
    if (!activeCheckout) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { subtotal, payable } = billingCalculations;
    const token = activeCheckout.patient_id || `ALLOC-${activeCheckout.id}`;

    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: activeCheckout.patient_name,
          patientPhone: activeCheckout.patient_phone,
          patientId: activeCheckout.patient_id,
          tokenNumber: token,
          billingType: "Discharge",
          subtotal,
          taxAmount: 0,
          discountAmount: 0,
          registrationFee: 0,
          payableAmount: payable,
          paymentStatus: status,
          paymentMethod: status === "Paid" ? paymentMethod : null,
          transactionId: status === "Paid" ? (transactionId || `TXN-${Date.now().toString().slice(-6)}`) : null,
          remarks: billingRemarks,
          details: {
            bedName: activeCheckout.bed_name,
            roomName: activeCheckout.room_name,
            wardName: activeCheckout.ward_name,
            allocatedAt: activeCheckout.allocated_at,
            dischargedAt: activeCheckout.discharged_at,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create discharge invoice");

      setSuccessMsg(
        status === "Paid"
          ? `Discharge room invoice ${data.invoice.invoice_number} paid successfully.`
          : `Discharge room invoice ${data.invoice.invoice_number} saved as Draft.`
      );
      setActiveCheckout(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pay a draft invoice
  const handlePayDraft = async () => {
    if (!payingDraft) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payingDraft.id,
          paymentStatus: "Paid",
          paymentMethod,
          transactionId: transactionId || `TXN-${Date.now().toString().slice(-6)}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment failed");

      setSuccessMsg(`Draft invoice ${data.invoice.invoice_number} checkout successfully.`);
      setPayingDraft(null);
      setSelectedInvoiceId(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Checkout failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actions for invoice
  const selectedInvoiceItem = useMemo(() => {
    return invoices.find(i => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const handlePrint = (invoice: InvoiceRecord, downloadAsPdf: boolean = false) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>${downloadAsPdf ? 'Download PDF' : 'Print Invoice'} - ${invoice.invoice_number}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .bold { font-weight: bold; }
            .total { font-size: 18px; border-top: 2px solid #eee; padding-top: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>DISCHARGE ROOM CHARGES INVOICE</h2>
            <p>${invoice.invoice_number}</p>
            <p>Date: ${new Date(invoice.created_at).toLocaleString()}</p>
          </div>
          
          <div class="row">
            <div>
              <p class="bold">Patient Information:</p>
              <p>Name: ${invoice.patient_name}</p>
              ${invoice.patient_id ? `<p>Patient ID: ${invoice.patient_id}</p>` : ''}
              ${invoice.patient_phone ? `<p>Phone: ${invoice.patient_phone}</p>` : ''}
            </div>
            <div>
              <p class="bold">Discharge Details:</p>
              <p>Bill Type: ${invoice.billing_type}</p>
              <p>Ref Token: ${invoice.token_number}</p>
            </div>
          </div>
          
          <div style="margin-top: 30px;">
            <p class="bold" style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Room Stay Charges</p>
            <div class="row"><span>Accrued Room Charges</span> <span>${currencySymbol}${Number(invoice.subtotal).toFixed(2)}</span></div>
            <div class="row total bold"><span>Grand Total</span> <span>${currencySymbol}${Number(invoice.payable_amount).toFixed(2)}</span></div>
          </div>

          <div style="margin-top: 30px; font-size: 12px;">
            <p class="bold">Payment Information</p>
            <p>Status: ${invoice.payment_status}</p>
            <p>Method: ${invoice.payment_method || 'N/A'}</p>
            <p>Transaction ID: ${invoice.transaction_id || 'N/A'}</p>
            ${invoice.remarks ? `<p>Remarks: ${invoice.remarks}</p>` : ''}
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700 dark:bg-green-950/20 dark:text-green-400 animate-in fade-in duration-200">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700 dark:bg-red-950/20 dark:text-red-400 animate-in fade-in duration-200">
          {errorMsg}
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("unbilled")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "unbilled"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Unbilled Queue
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "invoices"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Invoices / History
        </button>
      </div>

      {activeCheckout ? (
        /* Immediate Checkout Screen */
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-gray-800 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Checkout Discharge Room Charges</h2>
              <p className="text-xs text-slate-500 mt-1">Review room stay fees and complete payment gateway process.</p>
            </div>
            <button
              onClick={() => setActiveCheckout(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-lg"
            >
              Cancel Checkout
            </button>
          </div>

          <div className="max-w-xl mx-auto space-y-6 w-full">
            {/* 1. Patient & Room Stay Details */}
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 dark:border-gray-800 dark:bg-gray-900/50 space-y-2">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-2">Patient & Room Stay Details</h3>
              <div className="text-xs space-y-1.5 text-gray-600 dark:text-gray-400">
                <p>Patient Name: <strong className="text-gray-900 dark:text-white">{activeCheckout.patient_name}</strong></p>
                <p>Patient Phone: <strong className="text-gray-900 dark:text-white">{activeCheckout.patient_phone || "—"}</strong></p>
                <p>Patient ID: <strong className="text-gray-900 dark:text-white">{activeCheckout.patient_id || "—"}</strong></p>
                {activeCheckout.bed_name && (
                  <p>Bed / Room Location: <strong className="text-brand-600">{activeCheckout.bed_name}</strong> {activeCheckout.room_name ? `(${activeCheckout.room_name})` : ""}</p>
                )}
                {activeCheckout.allocated_at && <p>Admission Date: {formatDisplayDate(activeCheckout.allocated_at, true)}</p>}
                {activeCheckout.discharged_at && <p>Discharge Date: {formatDisplayDate(activeCheckout.discharged_at, true)}</p>}
              </div>
            </div>

            {/* 2. Payment Gateway Details */}
            <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-100 dark:bg-slate-900/60 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3">Payment Gateway Details</h3>
              
              <div className="space-y-3">
                <div>
                  <span className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Method</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Cash", "Card", "UPI", "Insurance"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m as any)}
                        className={`py-2 rounded-lg border text-xs font-semibold transition ${
                          paymentMethod === m 
                            ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400"
                            : "border-slate-200 text-gray-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod !== "Cash" && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-500 mb-1">Transaction reference ID</span>
                    <input
                      type="text"
                      placeholder="Enter txn/ref id"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <span className="block text-xs font-semibold text-gray-500 mb-1">Billing Remarks</span>
                  <input
                    type="text"
                    placeholder="Optional remarks"
                    value={billingRemarks}
                    onChange={(e) => setBillingRemarks(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* 3. Payment Total & Action Buttons */}
            <div className="space-y-4">
              <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 dark:border-gray-800 dark:bg-gray-900/30 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Room Charges Subtotal:</span>
                  <span>{formatCurrency(billingCalculations.subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-lg pt-1 border-t border-slate-100 dark:border-gray-800">
                  <span>Total Payable:</span>
                  <span>{formatCurrency(billingCalculations.payable)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => handleFinalizeInvoice("Paid")}
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 transition"
                >
                  {isSubmitting ? "Processing..." : "Approve & Pay (Finalize)"}
                </button>
                <button
                  onClick={() => handleFinalizeInvoice("Pending")}
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-slate-500 py-3 text-sm font-bold text-white hover:bg-slate-600 transition"
                >
                  {isSubmitting ? "Drafting..." : "Save as Draft (Pay Later)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "unbilled" ? (
        /* Unbilled Queue Table View */
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-gray-800 mb-4 gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Unbilled Discharge Room Charges</h3>
              <p className="text-xs text-gray-500 mt-0.5">Click on any patient row to open checkout immediately.</p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-xs text-gray-500">Loading discharge billing queue...</p>
          ) : pendingDischarges.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No inpatient room billings waiting to be processed.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-850">
              <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-3 py-2 text-left">Patient Name</th>
                    <th className="px-3 py-2 text-left">Patient Phone</th>
                    <th className="px-3 py-2 text-left">Patient ID</th>
                    <th className="px-3 py-2 text-left">Bed / Room</th>
                    <th className="px-3 py-2 text-left">Room Charges</th>
                    <th className="px-3 py-2 text-left">Admission Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                  {pendingDischarges.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => handleOpenBilling(d)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">{d.patient_name}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{d.patient_phone || "—"}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{d.patient_id || "—"}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{d.bed_name || "—"} {d.room_name ? `(${d.room_name})` : ""}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">{formatCurrency(Number(d.billing_amount))}</td>
                      <td className="px-3 py-2.5 text-slate-500">{formatDisplayDate(d.allocated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Invoices History Table View */
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-gray-800">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Filter Invoices by Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedInvoiceId(null);
                  }}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search Invoice No, Name, Phone, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  className="h-10 w-64 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  onClick={loadData}
                  className="h-10 rounded-xl bg-brand-500 px-4 text-xs font-bold text-white hover:bg-brand-600 transition"
                >
                  Search
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                disabled={!selectedInvoiceId}
                onClick={() => selectedInvoiceItem && setViewInvoiceModal(selectedInvoiceItem)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-50 transition"
              >
                View Details
              </button>
              <button
                disabled={!selectedInvoiceId || selectedInvoiceItem?.payment_status !== "Pending"}
                onClick={() => selectedInvoiceItem && setPayingDraft(selectedInvoiceItem)}
                className="inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                Pay Selected Draft
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-xs text-gray-500">Loading invoices...</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-xs text-gray-500">No discharge invoices generated on {formatDisplayDate(selectedDate)}.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-850">
              <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Patient</th>
                    <th className="px-3 py-2 text-left">Patient ID</th>
                    <th className="px-3 py-2 text-left">Payable</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInvoiceId(selectedInvoiceId === inv.id ? null : inv.id)}
                      className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-gray-800/50 ${
                        selectedInvoiceId === inv.id ? "bg-brand-50/70 dark:bg-brand-950/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceId === inv.id}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">{inv.invoice_number}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.patient_name}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.patient_id || "—"}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">{formatCurrency(Number(inv.payable_amount))}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.payment_status === "Paid" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}>
                          {inv.payment_status === "Pending" ? "Draft (Pending)" : inv.payment_status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.payment_method || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── OVERLAY: Checkout Draft Invoice ─── */}
      {payingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Pay Draft Invoice: {payingDraft.invoice_number}</h3>
              <button onClick={() => setPayingDraft(null)} className="text-gray-500 hover:text-gray-700 font-bold text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-slate-50 p-4 rounded-2xl dark:bg-slate-900/60">
                <p className="text-xs text-gray-500">Patient: {payingDraft.patient_name}</p>
                <p className="text-3xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">
                  {formatCurrency(Number(payingDraft.payable_amount))}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">Select Gateway Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Cash", "Card", "UPI", "Insurance"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m as any)}
                      className={`flex justify-center items-center py-2.5 rounded-xl border text-sm font-semibold transition ${
                        paymentMethod === m 
                          ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400"
                          : "border-slate-200 text-gray-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod !== "Cash" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">Transaction Reference ID</label>
                  <input
                    type="text"
                    placeholder="Enter ref transaction ID"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              )}

              <button
                onClick={handlePayDraft}
                disabled={isSubmitting}
                className="w-full mt-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 transition"
              >
                {isSubmitting ? "Processing..." : "Confirm Payment (Paid)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── OVERLAY: Invoice Detail Viewer ─── */}
      {viewInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Tax Invoice: {viewInvoiceModal.invoice_number}</h3>
              <button onClick={() => setViewInvoiceModal(null)} className="text-gray-500 hover:text-gray-700 font-bold text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-xs text-gray-500">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Patient: {viewInvoiceModal.patient_name}</p>
                  <p>Phone: {viewInvoiceModal.patient_phone || "—"}</p>
                  <p>Patient ID: {viewInvoiceModal.patient_id || "—"}</p>
                </div>
                <div className="text-right">
                  <p>Date: {formatDisplayDate(viewInvoiceModal.created_at, true)}</p>
                  <p>Bill Type: <strong>{viewInvoiceModal.billing_type}</strong></p>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-200 pt-3 dark:border-gray-800 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>Room Stay Charges Subtotal:</span>
                  <span>{formatCurrency(Number(viewInvoiceModal.subtotal))}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-sm pt-1 border-t border-slate-100 dark:border-gray-800">
                  <span>Total Amount Paid:</span>
                  <span>{formatCurrency(Number(viewInvoiceModal.payable_amount))}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-gray-800 bg-slate-50 dark:bg-slate-900/60 text-xs">
                <p className="font-semibold text-gray-800 dark:text-white">Gateway Details</p>
                <div className="grid grid-cols-2 gap-2 mt-1.5 text-gray-600 dark:text-gray-400">
                  <p>Status: <strong className="text-green-600 dark:text-green-400">{viewInvoiceModal.payment_status}</strong></p>
                  <p>Method: {viewInvoiceModal.payment_method || "—"}</p>
                  <p className="col-span-2">Txn ID: {viewInvoiceModal.transaction_id || "—"}</p>
                  {viewInvoiceModal.remarks && <p className="col-span-2">Remarks: {viewInvoiceModal.remarks}</p>}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrint(viewInvoiceModal, false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white transition"
                  >
                    Print Invoice
                  </button>
                </div>
                <button
                  onClick={() => setViewInvoiceModal(null)}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
