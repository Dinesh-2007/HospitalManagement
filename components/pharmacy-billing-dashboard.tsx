"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useHospitalTimezone } from "./context/HospitalTimezoneContext";

type InvoiceRecord = {
  id: number;
  invoice_number: string;
  patient_name: string;
  patient_phone?: string;
  token_number: string;
  billing_type: string;
  subtotal: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  payable_amount: string | number;
  payment_status: string;
  payment_method?: string;
  transaction_id?: string;
  doctor_name?: string;
  details?: string;
  created_at: string;
};

type PendingDispensing = {
  id: number;
  patient_name: string;
  patient_phone?: string;
  token_number: string;
  billing_amount?: string | number;
  medicine_lines?: string;
  created_at: string;
};

type DiscountSchema = {
  id: number;
  name: string;
  discountType: string;
  discount_type?: string;
  value: number;
  applyLevel: string;
  apply_level?: string;
  couponCode?: string;
  coupon_code?: string;
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

export function PharmacyBillingDashboard() {
  const params = useParams();
  const hname = decodeURIComponent(params?.Hname as string || "HSMS");

  const { todayDate } = useHospitalTimezone();

  const [pendingDispensings, setPendingDispensings] = useState<PendingDispensing[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [discounts, setDiscounts] = useState<DiscountSchema[]>([]);
  
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
  const [activeCheckout, setActiveCheckout] = useState<PendingDispensing | null>(null);
  const [payingDraft, setPayingDraft] = useState<InvoiceRecord | null>(null);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<InvoiceRecord | null>(null);

  // Pharmacy invoice billing configuration states
  const [phMedicineLines, setPhMedicineLines] = useState<any[]>([]);
  const [phTaxPercent, setPhTaxPercent] = useState(0); 
  const [phSelectedDiscountId, setPhSelectedDiscountId] = useState<string>("Custom");
  const [phDiscountWarning, setPhDiscountWarning] = useState("");
  const [phDiscountType, setPhDiscountType] = useState<"Amount" | "Percent">("Amount");
  const [phDiscountInput, setPhDiscountInput] = useState(0);
  const [phAdditionalFee, setPhAdditionalFee] = useState(0);
  const [phBillingRemarks, setPhBillingRemarks] = useState("");
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
      setPendingDispensings(pendingData.pendingDispensings || []);

      const invRes = await fetch(`/api/${encodeURIComponent(hname)}/billing`);
      const invData = await invRes.json();
      if (!invRes.ok) throw new Error(invData.error || "Failed to load invoices");
      const phInvoices = (invData.invoices || []).filter((i: InvoiceRecord) => i.billing_type === "Pharmacy");
      setInvoices(phInvoices);

      const discRes = await fetch(`/api/${encodeURIComponent(hname)}/forms/discount_schema`);
      const discData = await discRes.json();
      if (discRes.ok) {
        setDiscounts(discData.rows || []);
      }
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

  // Open pharmacy bill creation
  const handleOpenBilling = async (d: PendingDispensing) => {
    setActiveCheckout(d);
    setPhSelectedDiscountId("Custom");
    setPhDiscountWarning("");
    setPhDiscountInput(0);
    setPhAdditionalFee(0);
    setPhTaxPercent(0);
    setPhBillingRemarks("");
    setPaymentMethod("Cash");
    setTransactionId("");

    let lines: any[] = [];
    try {
      lines = JSON.parse(d.medicine_lines || "[]");
    } catch {
      lines = [];
    }
    setPhMedicineLines(lines);

    // Rule Check: check if visit-level discount was already applied to the Consultation invoice
    try {
      const discountCheckRes = await fetch(`/api/${encodeURIComponent(hname)}/billing`);
      const discountCheckData = await discountCheckRes.json();
      if (discountCheckRes.ok) {
        const matchingInvoices = (discountCheckData.invoices || []).filter((inv: any) => 
          inv.token_number === d.token_number && Number(inv.discount_amount) > 0
        );
        if (matchingInvoices.length > 0) {
          setPhDiscountWarning("A visit-level discount was already applied to the Consultation Invoice for this visit. In accordance with clinic policy to prevent double-discounting, additional discounts cannot be applied.");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculations for Pharmacy Invoice
  const billingCalculations = useMemo(() => {
    if (!activeCheckout) return { subtotal: 0, taxAmount: 0, discount: 0, payable: 0 };
    
    // Subtotal: sum up item subtotals
    const subtotal = phMedicineLines.reduce((acc, line) => {
      const qty = Number(line.receivedQty || line.prescribedQty || 0);
      const price = Number(line.medicineAmount || 0);
      return acc + (qty * price);
    }, 0);

    const baseForDiscount = subtotal + phAdditionalFee;
    let discount = 0;

    if (!phDiscountWarning) {
      if (phSelectedDiscountId === "Custom") {
        if (phDiscountType === "Amount") {
          discount = phDiscountInput;
        } else {
          discount = (baseForDiscount * phDiscountInput) / 100;
        }
      } else if (phSelectedDiscountId) {
        const schema = discounts.find(ds => String(ds.id) === phSelectedDiscountId);
        if (schema) {
          const val = Number(schema.value || 0);
          const discountTypeNormalized = schema.discountType || schema.discount_type;
          const applyLevelNormalized = schema.applyLevel || schema.apply_level;

          if (applyLevelNormalized === "Item") {
            // Apply percentage or flat discount at item level
            discount = phMedicineLines.reduce((acc, line) => {
              const qty = Number(line.receivedQty || line.prescribedQty || 0);
              const price = Number(line.medicineAmount || 0);
              const lineSub = qty * price;
              if (discountTypeNormalized === "Percentage") {
                return acc + (lineSub * (val / 100));
              } else {
                return acc + Math.min(val, lineSub);
              }
            }, 0);
          } else {
            // Apply globally at invoice level
            if (discountTypeNormalized === "Percentage") {
              discount = baseForDiscount * (val / 100);
            } else {
              discount = Math.min(val, baseForDiscount);
            }
          }
        }
      }
    }
    discount = Math.round(discount * 100) / 100;

    const afterDiscount = Math.max(0, baseForDiscount - discount);
    const taxAmount = Math.round((afterDiscount * (phTaxPercent / 100)) * 100) / 100;

    return {
      subtotal,
      taxAmount,
      discount,
      payable: Math.max(0, afterDiscount + taxAmount)
    };
  }, [activeCheckout, phMedicineLines, phTaxPercent, phSelectedDiscountId, discounts, phDiscountWarning, phDiscountInput, phDiscountType, phAdditionalFee]);

  // Submit and finalize invoice
  const handleFinalizeInvoice = async (status: "Paid" | "Pending") => {
    if (!activeCheckout) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { subtotal, taxAmount, discount, payable } = billingCalculations;

    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: activeCheckout.patient_name,
          patientPhone: activeCheckout.patient_phone,
          tokenNumber: activeCheckout.token_number,
          billingType: "Pharmacy",
          subtotal,
          taxAmount,
          discountAmount: discount,
          registrationFee: phAdditionalFee,
          payableAmount: payable,
          paymentStatus: status,
          paymentMethod: status === "Paid" ? paymentMethod : null,
          transactionId: status === "Paid" ? (transactionId || `TXN-${Date.now().toString().slice(-6)}`) : null,
          remarks: phBillingRemarks,
          details: {
            medicines: phMedicineLines,
            taxPercent: phTaxPercent,
            discountSchemaId: phSelectedDiscountId !== "Custom" ? phSelectedDiscountId : null,
            discountInput: phDiscountInput,
            discountType: phDiscountType
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create invoice");

      setSuccessMsg(
        status === "Paid"
          ? `Pharmacy invoice ${data.invoice.invoice_number} paid successfully.`
          : `Pharmacy invoice ${data.invoice.invoice_number} saved as Draft.`
      );
      setActiveCheckout(null);
      setSelectedPendingId(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create pharmacy invoice.");
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

      setSuccessMsg(`Draft pharmacy invoice ${data.invoice.invoice_number} checkout successfully.`);
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
    return pendingDispensings.find(d => d.id === selectedPendingId) || null;
  }, [pendingDispensings, selectedPendingId]);

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
            <h2>PHARMACY INVOICE</h2>
            <p>${invoice.invoice_number}</p>
            <p>Date: ${new Date(invoice.created_at).toLocaleString()}</p>
          </div>
          
          <div class="row">
            <div>
              <p class="bold">Patient Information:</p>
              <p>Name: ${invoice.patient_name}</p>
              <p>Token: ${invoice.token_number}</p>
              ${invoice.patient_phone ? `<p>Phone: ${invoice.patient_phone}</p>` : ''}
            </div>
            <div>
              <p class="bold">Billing Details:</p>
              <p>Type: ${invoice.billing_type}</p>
            </div>
          </div>
          
          <div style="margin-top: 30px;">
            <p class="bold" style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Charges</p>
            
            <div class="row"><span>Subtotal (Medicines)</span> <span>₹${Number(invoice.subtotal).toFixed(2)}</span></div>
            ${Number((invoice as any).registration_fee) > 0 ? `<div class="row"><span>Additional Fee</span> <span>₹${Number((invoice as any).registration_fee).toFixed(2)}</span></div>` : ''}
            ${Number(invoice.discount_amount) > 0 ? `<div class="row" style="color: red;"><span>Discount</span> <span>-₹${Number(invoice.discount_amount).toFixed(2)}</span></div>` : ''}
            ${Number(invoice.tax_amount) > 0 ? `<div class="row"><span>Tax</span> <span>₹${Number(invoice.tax_amount).toFixed(2)}</span></div>` : ''}
            
            <div class="row total bold"><span>Grand Total</span> <span>₹${Number(invoice.payable_amount).toFixed(2)}</span></div>
          </div>

          <div style="margin-top: 30px; font-size: 12px;">
            <p class="bold">Payment Information</p>
            <p>Status: ${invoice.payment_status}</p>
            <p>Method: ${invoice.payment_method || 'N/A'}</p>
            <p>Transaction ID: ${invoice.transaction_id || 'N/A'}</p>
            ${(invoice as any).remarks ? `<p>Remarks: ${(invoice as any).remarks}</p>` : ''}
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
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Checkout Pharmacy Bill</h2>
              <p className="text-xs text-slate-500 mt-1">Review line items, configure taxes/discounts, and process gateway payment.</p>
            </div>
            <button
              onClick={() => setActiveCheckout(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-lg"
            >
              Cancel Checkout
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left side: items details, tax & discounts */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 dark:border-gray-800 dark:bg-gray-900/50">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-2">Patient & Order Reference</h3>
                <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                  <p>Patient Name: <strong className="text-gray-900 dark:text-white">{activeCheckout.patient_name}</strong></p>
                  {activeCheckout.patient_phone && <p>Mobile: {activeCheckout.patient_phone}</p>}
                  <p>Dispensing Token: {activeCheckout.token_number}</p>
                </div>
              </div>

              {/* Medicine Item Table */}
              <div className="rounded-2xl border border-slate-100 overflow-hidden dark:border-gray-800">
                <table className="min-w-full text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-white/[0.02]">
                    <tr>
                      <th className="px-3 py-2 text-left">Medicine</th>
                      <th className="px-3 py-2 text-left">Qty</th>
                      <th className="px-3 py-2 text-left">Price</th>
                      <th className="px-3 py-2 text-left">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                    {phMedicineLines.map((line, idx) => {
                      const qty = Number(line.receivedQty || line.prescribedQty || 0);
                      const price = Number(line.medicineAmount || 0);
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{line.medicineName}</td>
                          <td className="px-3 py-2">{qty}</td>
                          <td className="px-3 py-2">₹{price.toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold">₹{(qty * price).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Discount Selection */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400">Apply Discount</span>
                {phDiscountWarning ? (
                  <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 font-medium">
                    {phDiscountWarning}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select
                      value={phSelectedDiscountId}
                      onChange={(e) => setPhSelectedDiscountId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="Custom">Custom Manual Discount</option>
                      {discounts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.discountType || d.discount_type} - {d.value}{ (d.discountType || d.discount_type) === "Percentage" ? "%" : " Rs"}) [{d.applyLevel || d.apply_level} Level]
                        </option>
                      ))}
                    </select>
                    {phSelectedDiscountId === "Custom" && (
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setPhDiscountType("Amount")} className={`flex-1 py-1 text-xs rounded-md border ${phDiscountType === 'Amount' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-gray-200'}`}>Amount</button>
                          <button type="button" onClick={() => setPhDiscountType("Percent")} className={`flex-1 py-1 text-xs rounded-md border ${phDiscountType === 'Percent' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-gray-200'}`}>Percent</button>
                        </div>
                        <input type="number" min="0" value={phDiscountInput} onChange={(e) => setPhDiscountInput(Number(e.target.value) || 0)} className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" placeholder="Enter discount..." />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tax configuration */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Taxes (GST %):</span>
                <input
                  type="number"
                  min="0"
                  value={phTaxPercent}
                  onChange={(e) => setPhTaxPercent(Number(e.target.value) || 0)}
                  className="w-20 h-7 text-right border rounded text-xs px-2 dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>

            {/* Right side: Payment & Summary */}
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

                  <div>
                    <span className="block text-xs font-semibold text-gray-500 mb-1">Billing Remarks</span>
                    <input
                      type="text"
                      placeholder="Optional remarks"
                      value={phBillingRemarks}
                      onChange={(e) => setPhBillingRemarks(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Subtotal summary */}
              <div className="p-4 border-t border-dashed border-slate-200 dark:border-gray-800 space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                  <span>Additional Fee:</span>
                  <input type="number" value={phAdditionalFee} onChange={e => setPhAdditionalFee(Number(e.target.value) || 0)} className="w-24 h-7 text-right border rounded text-xs px-2 dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal:</span>
                  <span>₹{billingCalculations.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Taxes ({phTaxPercent}%):</span>
                  <span>₹{billingCalculations.taxAmount.toFixed(2)}</span>
                </div>
                {billingCalculations.discount > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Discount Applied:</span>
                    <span>-₹{billingCalculations.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-lg pt-1 border-t border-slate-100 dark:border-gray-800">
                  <span>Total Payable:</span>
                  <span>₹{billingCalculations.payable.toFixed(2)}</span>
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
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Unbilled Pharmacy Dispensings</h3>
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
            <p className="text-xs text-gray-500">Loading dispensings...</p>
          ) : pendingDispensings.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No completed pharmacy dispensing records waiting.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-850">
              <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Patient Name</th>
                    <th className="px-3 py-2 text-left">Patient Phone</th>
                    <th className="px-3 py-2 text-left">Dispensing Token</th>
                    <th className="px-3 py-2 text-left">Pre-Tax Amount</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                  {pendingDispensings.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedPendingId(selectedPendingId === d.id ? null : d.id)}
                      className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-gray-800/50 ${
                        selectedPendingId === d.id ? "bg-brand-50/70 dark:bg-brand-950/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedPendingId === d.id}
                          onChange={() => {}} // handled by tr onClick
                          className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">{d.patient_name}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{d.patient_phone || "—"}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{d.token_number}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">₹{Number(d.billing_amount).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-slate-500">{formatDisplayDate(d.created_at)}</td>
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
                  placeholder="Search Invoice No, Name, Phone..."
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
            <p className="text-xs text-gray-500">No pharmacy invoices generated on {formatDisplayDate(selectedDate)}.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-850">
              <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Patient Name</th>
                    <th className="px-3 py-2 text-left">Token</th>
                    <th className="px-3 py-2.5 text-left">Payable</th>
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
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{inv.token_number}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">₹{Number(inv.payable_amount).toFixed(2)}</td>
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
                  ₹{Number(payingDraft.payable_amount).toFixed(2)}
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
                <div className="space-y-2">
                  {(() => {
                    let items: any[] = [];
                    try {
                      const parsed = JSON.parse(viewInvoiceModal.details || "{}");
                      items = parsed.medicines || [];
                    } catch {
                      items = [];
                    }
                    return items.map((line: any, idx: number) => {
                      const qty = Number(line.receivedQty || line.prescribedQty || 0);
                      const price = Number(line.medicineAmount || 0);
                      return (
                        <div key={idx} className="flex justify-between">
                          <span>{line.medicineName} (x{qty})</span>
                          <span>₹{(qty * price).toFixed(2)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Receipt Summary */}
              <div className="border-t border-dashed border-gray-200 pt-3 dark:border-gray-800 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal:</span>
                  <span>₹{Number(viewInvoiceModal.subtotal).toFixed(2)}</span>
                </div>
                {Number((viewInvoiceModal as any).registration_fee) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Additional Fee:</span>
                    <span>₹{Number((viewInvoiceModal as any).registration_fee).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewInvoiceModal.discount_amount) > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Discount:</span>
                    <span>-₹{Number(viewInvoiceModal.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewInvoiceModal.tax_amount) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax:</span>
                    <span>₹{Number(viewInvoiceModal.tax_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-sm pt-1 border-t border-slate-100 dark:border-gray-800">
                  <span>Total Amount Paid:</span>
                  <span>₹{Number(viewInvoiceModal.payable_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Gateway details */}
              <div className="rounded-xl border border-slate-200 p-3 dark:border-gray-800 bg-slate-50 dark:bg-slate-900/60 text-xs">
                <p className="font-semibold text-gray-800 dark:text-white">Gateway Details</p>
                <div className="grid grid-cols-2 gap-2 mt-1.5 text-gray-600 dark:text-gray-400">
                  <p>Status: <strong className="text-green-600 dark:text-green-400">{viewInvoiceModal.payment_status}</strong></p>
                  <p>Method: {viewInvoiceModal.payment_method || "—"}</p>
                  <p className="col-span-2">Txn ID: {viewInvoiceModal.transaction_id || "—"}</p>
                  {(viewInvoiceModal as any).remarks && <p className="col-span-2">Remarks: {(viewInvoiceModal as any).remarks}</p>}
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
