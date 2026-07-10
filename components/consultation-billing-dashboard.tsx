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
  token_number: string;
  billing_type: string;
  subtotal: string | number;
  registration_fee?: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  payable_amount: string | number;
  payment_status: string;
  payment_method?: string;
  transaction_id?: string;
  doctor_name?: string;
  details?: string;
  remarks?: string;
  patient_id?: string;
  created_at: string;
};

type PendingConsultation = {
  id: number;
  patient_details: string;
  token_number: string;
  doctor: string;
  department: string;
  diagnosis_name?: string;
  consultation_amount?: string | number;
  created_at: string;
  patient_id?: string;
  visit_type?: string;
  appointment_date?: string;
  appointment_time?: string;
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

export function ConsultationBillingDashboard() {
  const params = useParams();
  const hname = decodeURIComponent(params?.Hname as string || "HSMS");

  const { todayDate } = useHospitalTimezone();
  const { formatCurrency, currencySymbol } = useHospitalCurrency();

  const [pendingConsultations, setPendingConsultations] = useState<PendingConsultation[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Views & filters
  const [activeTab, setActiveTab] = useState<"unbilled" | "invoices">("unbilled");
  const [selectedDate, setSelectedDate] = useState(() => todayDate);

  // Selection states
  const [selectedPendingId, setSelectedPendingId] = useState<number | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // checkout modals
  const [activeCheckout, setActiveCheckout] = useState<PendingConsultation | null>(null);
  const [payingDraft, setPayingDraft] = useState<InvoiceRecord | null>(null);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<InvoiceRecord | null>(null);

  // Billing calculation states
  const [consRateOption, setConsRateOption] = useState<"Full" | "FollowUpFree" | "FollowUpHalf" | "Custom">("Full");
  const [consFollowUpInfo, setConsFollowUpInfo] = useState<{ isFollowUp: boolean; originalVisitDate: string | null } | null>(null);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"Amount" | "Percent">("Amount");
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
      setPendingConsultations(pendingData.pendingConsultations || []);

      const invRes = await fetch(`/api/${encodeURIComponent(hname)}/billing${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`);
      const invData = await invRes.json();
      if (!invRes.ok) throw new Error(invData.error || "Failed to load invoices");
      const consInvoices = (invData.invoices || []).filter((i: InvoiceRecord) => i.billing_type === "Consultation");
      setInvoices(consInvoices);
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

  // Open checkout for selected unbilled record
  const handleOpenBilling = async (c: PendingConsultation) => {
    setActiveCheckout(c);
    setConsRateOption("Full");
    setConsFollowUpInfo(null);
    setPaymentMethod("Cash");
    setTransactionId("");
    setRegistrationFee(0);
    setTaxPercent(0);
    setDiscountInput(0);
    setDiscountType("Amount");
    setBillingRemarks("");

    try {
      const checkUrl = `/api/${encodeURIComponent(hname)}/billing?action=check-followup&patientName=${encodeURIComponent(c.patient_details)}&doctor=${encodeURIComponent(c.doctor)}&diagnosis=${encodeURIComponent(c.diagnosis_name || "")}`;
      const res = await fetch(checkUrl);
      const data = await res.json();
      if (res.ok && data.isFollowUp) {
        setConsFollowUpInfo({
          isFollowUp: true,
          originalVisitDate: data.originalVisitDate,
        });
        
        // Auto default to free follow-up if within 10 days, otherwise 50% discount
        const originalDate = new Date(data.originalVisitDate);
        const currentDate = new Date(c.created_at || Date.now());
        const daysDiff = Math.ceil(Math.abs(currentDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 10) {
          setConsRateOption("FollowUpFree");
        } else {
          setConsRateOption("FollowUpHalf");
        }
      }
    } catch (err) {
      console.error("Error checking follow-up status:", err);
    }
  };

  // Calculations for Consultation Invoice
  const billingCalculations = useMemo(() => {
    if (!activeCheckout) return { subtotal: 0, registrationFee, discount: 0, tax: 0, payable: 0 };
    const subtotal = Number(activeCheckout.consultation_amount || 0);
    let discount = 0;
    if (consRateOption === "FollowUpFree") {
      discount = subtotal;
    } else if (consRateOption === "FollowUpHalf") {
      discount = Math.round(subtotal * 0.5);
    } else if (consRateOption === "Custom") {
      discount = discountType === "Amount" ? discountInput : Math.round((subtotal + registrationFee) * (discountInput / 100));
    }
    
    // Tax is applied after discount on (subtotal + registration fee)
    const afterDiscount = Math.max(0, (subtotal + registrationFee) - discount);
    const tax = Math.round(afterDiscount * (taxPercent / 100));
    const payable = afterDiscount + tax;

    return {
      subtotal,
      registrationFee,
      discount,
      tax,
      payable
    };
  }, [activeCheckout, consRateOption, registrationFee, taxPercent, discountInput, discountType]);

  // Submit and finalize billing
  const handleFinalizeInvoice = async (status: "Paid" | "Pending") => {
    if (!activeCheckout) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    
    const { subtotal, registrationFee, discount, tax, payable } = billingCalculations;

    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: activeCheckout.patient_details,
          patientId: activeCheckout.patient_id,
          tokenNumber: activeCheckout.token_number,
          billingType: "Consultation",
          subtotal,
          registrationFee,
          taxAmount: tax,
          discountAmount: discount,
          payableAmount: payable,
          paymentStatus: status,
          paymentMethod: status === "Paid" ? paymentMethod : null,
          transactionId: status === "Paid" ? (transactionId || `TXN-${Date.now().toString().slice(-6)}`) : null,
          doctorName: activeCheckout.doctor,
          remarks: billingRemarks,
          details: {
            doctor: activeCheckout.doctor,
            department: activeCheckout.department,
            diagnosis: activeCheckout.diagnosis_name,
            visitType: activeCheckout.visit_type === 'walk-in' ? 'OP' : 'OP', // default to OP
            pricingTier: consRateOption,
            originalVisitDate: consFollowUpInfo?.originalVisitDate,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to finalize invoice");

      setSuccessMsg(
        status === "Paid"
          ? `Invoice ${data.invoice.invoice_number} paid successfully.`
          : `Invoice ${data.invoice.invoice_number} saved as Draft.`
      );
      setActiveCheckout(null);
      setSelectedPendingId(null);
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

  // Actions for unbilled
  const selectedPendingItem = useMemo(() => {
    return pendingConsultations.find(c => c.id === selectedPendingId) || null;
  }, [pendingConsultations, selectedPendingId]);

  // Actions for invoice
  const selectedInvoiceItem = useMemo(() => {
    return invoices.find(i => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const handlePrint = (invoice: InvoiceRecord, downloadAsPdf: boolean = false) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;
    
    // HTML string for the invoice
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
            .badge { background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>HOSPITAL INVOICE</h2>
            <p>${invoice.invoice_number}</p>
            <p>Date: ${new Date(invoice.created_at).toLocaleString()}</p>
          </div>
          
          <div class="row">
            <div>
              <p class="bold">Patient Information:</p>
              <p>Name: ${invoice.patient_name}</p>
              <p>ID/Token: ${invoice.token_number}</p>
              ${invoice.patient_id ? `<p>Patient ID: ${invoice.patient_id}</p>` : ''}
              ${invoice.patient_phone ? `<p>Phone: ${invoice.patient_phone}</p>` : ''}
            </div>
            <div>
              <p class="bold">Consultation Details:</p>
              <p>Doctor: ${invoice.doctor_name || 'N/A'}</p>
              <p>Bill Type: ${invoice.billing_type}</p>
            </div>
          </div>
          
          <div style="margin-top: 30px;">
            <p class="bold" style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Charges</p>
            
            <div class="row"><span>Consultation Fee</span> <span>${currencySymbol}${Number(invoice.subtotal).toFixed(2)}</span></div>
            ${Number(invoice.registration_fee) > 0 ? `<div class="row"><span>Registration Fee</span> <span>${currencySymbol}${Number(invoice.registration_fee).toFixed(2)}</span></div>` : ''}
            ${Number(invoice.discount_amount) > 0 ? `<div class="row" style="color: red;"><span>Discount</span> <span>-${currencySymbol}${Number(invoice.discount_amount).toFixed(2)}</span></div>` : ''}
            ${Number(invoice.tax_amount) > 0 ? `<div class="row"><span>Tax</span> <span>${currencySymbol}${Number(invoice.tax_amount).toFixed(2)}</span></div>` : ''}
            
            <div class="row total bold"><span>Grand Total</span> <span>${currencySymbol}${Number(invoice.payable_amount).toFixed(2)}</span></div>
          </div>

          <div style="margin-top: 30px; font-size: 12px;">
            <p class="bold">Payment Information</p>
            <p>Status: ${invoice.payment_status}</p>
            <p>Method: ${invoice.payment_method || 'N/A'}</p>
            <p>Transaction ID: ${invoice.transaction_id || 'N/A'}</p>
            ${invoice.remarks ? `<p>Remarks: ${invoice.remarks}</p>` : ''}
          </div>
          
          <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #777;">
            <p>Thank you for visiting.</p>
            ${downloadAsPdf ? '<p style="margin-top:20px; font-weight:bold; color:#000;">* To save as PDF, select "Save as PDF" in your print dialog.</p>' : ''}
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
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Checkout Consultation</h2>
              <p className="text-xs text-slate-500 mt-1">Review fees, apply follow-up rules, and complete payment gateway.</p>
            </div>
            <button
              onClick={() => setActiveCheckout(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-lg"
            >
              Cancel Checkout
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left side: details & rates */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 dark:border-gray-800 dark:bg-gray-900/50">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-2">Patient Details</h3>
                <div className="text-xs space-y-1.5 text-gray-600 dark:text-gray-400">
                  <p>Patient Name: <strong className="text-gray-900 dark:text-white">{activeCheckout.patient_details}</strong></p>
                  <p>Doctor Name: {activeCheckout.doctor} ({activeCheckout.department})</p>
                  <p>Token / Visit ID: {activeCheckout.token_number}</p>
                  {activeCheckout.diagnosis_name && <p>Diagnosis: <strong className="text-brand-600">{activeCheckout.diagnosis_name}</strong></p>}
                </div>
              </div>

              {/* Follow-up evaluator */}
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 dark:border-gray-800 dark:bg-gray-900/50">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">Follow-up Assessment</h3>
                {consFollowUpInfo?.isFollowUp ? (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Follow-up visit detected!</p>
                    <p className="text-[11px] text-gray-500">Original visit date: {formatDisplayDate(consFollowUpInfo.originalVisitDate || undefined)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mb-3">No previous consultations found for this doctor and diagnosis.</p>
                )}

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-gray-500">Select Pricing Tier:</span>
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="pricingTier"
                        checked={consRateOption === "Full"}
                        onChange={() => setConsRateOption("Full")}
                      />
                      Standard First Visit Rate ({formatCurrency(Number(activeCheckout.consultation_amount))})
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="pricingTier"
                        checked={consRateOption === "FollowUpFree"}
                        onChange={() => setConsRateOption("FollowUpFree")}
                      />
                      Follow-up visit rate (Free / {formatCurrency(0)})
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="pricingTier"
                        checked={consRateOption === "FollowUpHalf"}
                        onChange={() => setConsRateOption("FollowUpHalf")}
                      />
                      Follow-up visit rate (50% Discount)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: payment & gateway */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-100 dark:bg-slate-900/60 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3">Payment Gateway Details</h3>
                
                <div className="space-y-3">
                  <div>
                    <span className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Method</span>
                    <div className="grid grid-cols-2 gap-2">
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

                  <div>
                    <span className="block text-xs font-semibold text-gray-500 mb-1">Transaction reference ID</span>
                    <input
                      type="text"
                      placeholder={paymentMethod === "Cash" ? "Optional for Cash" : "Enter txn/ref id"}
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Subtotal summary */}
              <div className="p-4 border-t border-dashed border-slate-200 dark:border-gray-800 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Consultation Fee:</span>
                  <span>{formatCurrency(billingCalculations.subtotal)}</span>
                </div>
                {billingCalculations.discount > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Discount Applied:</span>
                    <span>-{formatCurrency(billingCalculations.discount)}</span>
                  </div>
                )}
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
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Unbilled Consultation Visits</h3>
              <p className="text-xs text-gray-500 mt-0.5">Select a patient row and click "Checkout & Pay" at the top.</p>
            </div>
            <button
              disabled={!selectedPendingId}
              onClick={() => selectedPendingItem && handleOpenBilling(selectedPendingItem)}
              className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout & Pay Selected
            </button>
          </div>

          {isLoading ? (
            <p className="text-xs text-gray-500">Loading consultations...</p>
          ) : pendingConsultations.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No completed consultations waiting to be billed.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-850">
              <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Patient Details</th>
                    <th className="px-3 py-2 text-left">Patient ID</th>
                    <th className="px-3 py-2 text-left">Doctor</th>
                    <th className="px-3 py-2 text-left">Department</th>
                    <th className="px-3 py-2 text-left">Visit Token</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Consultation Fee</th>
                    <th className="px-3 py-2 text-left">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                  {pendingConsultations.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedPendingId(selectedPendingId === c.id ? null : c.id)}
                      className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-gray-800/50 ${
                        selectedPendingId === c.id ? "bg-brand-50/70 dark:bg-brand-950/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedPendingId === c.id}
                          onChange={() => {}} // handled by tr onClick
                          className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">{c.patient_details}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{c.patient_id || "—"}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{c.doctor}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{c.department}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{c.token_number}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{c.visit_type === 'walk-in' ? 'OP' : (c.visit_type || 'OP').toUpperCase()}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">{formatCurrency(Number(c.consultation_amount))}</td>
                      <td className="px-3 py-2.5 text-slate-500">{formatDisplayDate(c.appointment_date || c.created_at)} {c.appointment_time || ''}</td>
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
          {/* Date Picker on top */}
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
            
            {/* Top action buttons */}
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
            <p className="text-xs text-gray-500">No consultation invoices generated on {formatDisplayDate(selectedDate)}.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-850">
              <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Patient</th>
                    <th className="px-3 py-2 text-left">Doctor</th>
                    <th className="px-3 py-2 text-left">Token</th>
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
                          onChange={() => {}} // handled by tr onClick
                          className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">{inv.invoice_number}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.patient_name}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.doctor_name || "—"}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.token_number}</td>
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

              {/* Payment Methods */}
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

              {/* Reference */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">Transaction Reference ID</label>
                <input
                  type="text"
                  placeholder={paymentMethod === "Cash" ? "Optional for Cash" : "Enter ref transaction ID"}
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

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
                  <p>Visit Token: {viewInvoiceModal.token_number}</p>
                </div>
                <div className="text-right">
                  <p>Date: {formatDisplayDate(viewInvoiceModal.created_at, true)}</p>
                  <p>Bill Type: <strong>{viewInvoiceModal.billing_type}</strong></p>
                  {viewInvoiceModal.doctor_name && <p>Doctor: {viewInvoiceModal.doctor_name}</p>}
                </div>
              </div>

              {/* Items details */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-gray-800 dark:bg-slate-900/40 text-xs">
                <p className="font-bold text-gray-800 dark:text-white mb-2">Billing Details</p>
                <div>
                  <div className="flex justify-between">
                    <span>Doctor Consultation Fee</span>
                    <span>{formatCurrency(Number(viewInvoiceModal.subtotal))}</span>
                  </div>
                  {(() => {
                    try {
                      const parsed = JSON.parse(viewInvoiceModal.details || "{}");
                      return parsed.visitType === "Follow-up Visit" ? (
                        <p className="text-[10px] text-amber-600 font-semibold mt-1">
                          Follow-up visit policy discount applied
                        </p>
                      ) : null;
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              </div>

              {/* Receipt Summary */}
              <div className="border-t border-dashed border-gray-200 pt-3 dark:border-gray-800 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>Consultation Fee:</span>
                  <span>{formatCurrency(Number(viewInvoiceModal.subtotal))}</span>
                </div>
                {Number(viewInvoiceModal.registration_fee) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Registration Fee:</span>
                    <span>{formatCurrency(Number(viewInvoiceModal.registration_fee))}</span>
                  </div>
                )}
                {Number(viewInvoiceModal.discount_amount) > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Discount:</span>
                    <span>-{formatCurrency(Number(viewInvoiceModal.discount_amount))}</span>
                  </div>
                )}
                {Number(viewInvoiceModal.tax_amount) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax:</span>
                    <span>{formatCurrency(Number(viewInvoiceModal.tax_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-sm pt-1 border-t border-slate-100 dark:border-gray-800">
                  <span>Total Amount Paid:</span>
                  <span>{formatCurrency(Number(viewInvoiceModal.payable_amount))}</span>
                </div>
              </div>

              {/* Gateway details */}
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
                  <button
                    onClick={() => handlePrint(viewInvoiceModal, true)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white transition"
                  >
                    Download PDF
                  </button>
                </div>
                <button
                  onClick={() => setViewInvoiceModal(null)}
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
