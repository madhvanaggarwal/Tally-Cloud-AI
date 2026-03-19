// ============================================================
// InvoiceForm.jsx  —  React Component
// Full sales invoice form. E-Way Bill drawer opens
// automatically when invoice total >= ₹50,000.
//
// Stack: React 18, Tailwind CSS, Lucide icons, shadcn/ui
// Install:  npm install lucide-react
// ============================================================

import { useState, useEffect } from "react";
import {
  AlertTriangle, Truck, Lock, CheckCircle2,
  Plus, Trash2, FileText, Loader2, X,
} from "lucide-react";
import { useEwayBill } from "./useEwayBill";

// ── helpers ────────────────────────────────────────────────
const INR = (n) =>
  "₹" + Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const GST_RATES = [0, 5, 12, 18, 28];

const emptyLine = () => ({
  id:          Date.now() + Math.random(),
  itemName:    "",
  hsn:         "",
  qty:         1,
  unit:        "Pcs",
  rate:        0,
  gstRate:     18,
  amount:      0,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 0,
});

// ── Line row ───────────────────────────────────────────────
function LineRow({ line, onChange, onRemove }) {
  const updateField = (field, value) => {
    const updated = { ...line, [field]: value };

    // Recompute amounts whenever qty / rate / gstRate changes
    const base     = Math.round(updated.qty * updated.rate * 100) / 100;
    const tax      = Math.round(base * updated.gstRate / 100 * 100) / 100;
    const halfTax  = Math.round(tax / 2 * 100) / 100;

    updated.amount      = base;
    updated.cgst_amount = halfTax;
    updated.sgst_amount = halfTax;
    updated.igst_amount = 0;

    onChange(updated);
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2">
        <input
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
          value={line.itemName}
          onChange={(e) => updateField("itemName", e.target.value)}
          placeholder="Item name"
        />
      </td>
      <td className="px-3 py-2">
        <input
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 font-mono"
          value={line.hsn}
          onChange={(e) => updateField("hsn", e.target.value)}
          placeholder="HSN"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
          value={line.qty}
          onChange={(e) => updateField("qty", parseFloat(e.target.value) || 0)}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
          value={line.unit}
          onChange={(e) => updateField("unit", e.target.value)}
        >
          {["Pcs", "Kg", "Ltr", "Box", "Bag", "Nos", "Set"].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
          value={line.rate}
          onChange={(e) => updateField("rate", parseFloat(e.target.value) || 0)}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
          value={line.gstRate}
          onChange={(e) => updateField("gstRate", parseFloat(e.target.value))}
        >
          {GST_RATES.map((r) => (
            <option key={r} value={r}>{r}%</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm font-medium text-gray-800">
        {INR(line.amount)}
      </td>
      <td className="px-2 py-2">
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── E-Way Bill Drawer ──────────────────────────────────────
function EWayBillDrawer({ open, invoiceTotal, partyName, partyGstin, invoiceNo, onClose, onSubmit }) {
  const [form, setForm]       = useState({ transMode: "1", vehicleNo: "", distance: "", transName: "", supplyType: "O" });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [ewbNum, setEwbNum]   = useState("");

  // Reset when drawer opens
  useEffect(() => {
    if (open) { setDone(false); setLoading(false); setEwbNum(""); }
  }, [open]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await onSubmit(form);
      setEwbNum(result?.ewbNo || "241024087563412"); // fallback for demo
      setDone(true);
    } catch {
      // error handled in hook
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }}>
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-widest">
              E-Way Bill Required
            </span>
            <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Generate E-Way Bill</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Invoice total {INR(invoiceTotal)} &ge; ₹50,000 — mandatory under GST Rule 138
          </p>
        </div>

        {done ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-3">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">E-Way Bill generated!</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-3">
              <p className="text-xs text-gray-400 mb-1">E-Way Bill number</p>
              <p className="font-mono text-base font-semibold text-gray-800">{ewbNum}</p>
            </div>
            <p className="text-xs text-gray-400">Valid 72 hrs · Saved to voucher · Backed up to Google Drive</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form state */
          <div className="flex-1 px-6 py-5 space-y-5">

            {/* Invoice summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice no.</span>
                <span className="font-mono font-medium text-gray-800">{invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Party</span>
                <span className="font-medium text-gray-800">{partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GSTIN</span>
                <span className="font-mono text-xs text-gray-700">{partyGstin}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-500">Invoice total</span>
                <span className="font-semibold text-gray-900 text-base">{INR(invoiceTotal)}</span>
              </div>
            </div>

            {/* Secure credentials notice */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock size={12} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-800">NIC credentials loaded from secure vault</p>
                <p className="text-xs text-blue-600 mt-0.5">AES-256-GCM encrypted · Never stored in plaintext · Google Secret Manager</p>
              </div>
            </div>

            {/* Transport fields */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Transport details</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Mode of transport</label>
                  <select
                    value={form.transMode}
                    onChange={(e) => setForm((p) => ({ ...p, transMode: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="1">Road</option>
                    <option value="2">Rail</option>
                    <option value="3">Air</option>
                    <option value="4">Ship</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Vehicle number</label>
                    <input
                      type="text"
                      value={form.vehicleNo}
                      onChange={(e) => setForm((p) => ({ ...p, vehicleNo: e.target.value.toUpperCase() }))}
                      placeholder="DL 01 AB 1234"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Distance (km)</label>
                    <input
                      type="number"
                      value={form.distance}
                      onChange={(e) => setForm((p) => ({ ...p, distance: e.target.value }))}
                      placeholder="e.g. 120"
                      min="1"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Transporter name</label>
                  <input
                    type="text"
                    value={form.transName}
                    onChange={(e) => setForm((p) => ({ ...p, transName: e.target.value }))}
                    placeholder="Enter transporter or logistics company"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Supply type</label>
                  <select
                    value={form.supplyType}
                    onChange={(e) => setForm((p) => ({ ...p, supplyType: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="O">Outward supply</option>
                    <option value="I">Inward supply</option>
                    <option value="J">Job work</option>
                    <option value="SKD">SKD/CKD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Submitting to NIC portal…</>
              ) : (
                <><Truck size={15} /> Generate E-Way Bill</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Invoice Form ──────────────────────────────────────
export default function InvoiceForm() {
  const [invoiceNo]            = useState("INV-2024-091");
  const [partyName, setParty]  = useState("Rajesh Traders");
  const [gstin, setGstin]      = useState("07AADCB2230M1ZH");
  const [date, setDate]        = useState(new Date().toISOString().split("T")[0]);
  const [supply, setSupply]    = useState("Delhi (07)");
  const [narration, setNarr]   = useState("");
  const [drawerOpen, setDrawer]= useState(false);

  const [lines, setLines] = useState([
    { ...emptyLine(), itemName: "Surf Excel 1kg",    hsn: "3402", qty: 200, rate: 95,  gstRate: 18, unit: "Pcs", amount: 19000, cgst_amount: 1710,   sgst_amount: 1710,   igst_amount: 0 },
    { ...emptyLine(), itemName: "Basmati Rice 5kg",  hsn: "1006", qty: 30,  rate: 300, gstRate: 5,  unit: "Bag", amount: 9000,  cgst_amount: 225,     sgst_amount: 225,     igst_amount: 0 },
  ]);

  const { total, subtotal, cgst, sgst, ewayRequired, threshold, submit, status, ewbNo } = useEwayBill(lines, invoiceNo);

  const updateLine  = (id, updated) => setLines((prev) => prev.map((l) => (l.id === id ? updated : l)));
  const removeLine  = (id)          => setLines((prev) => prev.filter((l) => l.id !== id));
  const addLine     = ()            => setLines((prev) => [...prev, emptyLine()]);

  const handleSave  = () => {
    if (ewayRequired) { setDrawer(true); return; }
    alert("Invoice saved! (No E-Way Bill required — total below ₹50,000)");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileText size={18} className="text-blue-700" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">New sales invoice</h1>
            <p className="text-sm text-gray-500">
              E-Way Bill triggers automatically when total &ge; ₹{threshold.toLocaleString("en-IN")}
            </p>
          </div>
          <span className="ml-auto font-mono text-sm text-gray-400 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            {invoiceNo}
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Party & Date */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Party & date</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Party name</label>
                <input
                  value={partyName}
                  onChange={(e) => setParty(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Party GSTIN</label>
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Invoice date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Place of supply</label>
                <select
                  value={supply}
                  onChange={(e) => setSupply(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                >
                  {["Delhi (07)", "Maharashtra (27)", "Karnataka (29)", "Tamil Nadu (33)", "Gujarat (24)", "Rajasthan (08)", "Uttar Pradesh (09)"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Line items</p>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Item", "HSN/SAC", "Qty", "Unit", "Rate (₹)", "GST %", "Amount (₹)", ""].map((h) => (
                      <th key={h} className="text-left text-xs text-gray-400 font-medium px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      onChange={(updated) => updateLine(line.id, updated)}
                      onRemove={() => removeLine(line.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addLine}
              className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> Add line item
            </button>
          </div>

          {/* Totals */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                {[
                  ["Subtotal", subtotal],
                  ["CGST",     cgst],
                  ["SGST",     sgst],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono text-gray-700">{INR(val)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-semibold border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Invoice total</span>
                  <span className={`font-mono ${total >= threshold ? "text-amber-700" : "text-gray-900"}`}>
                    {INR(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* E-Way Bill banner — shows when total >= ₹50,000 */}
          {ewayRequired && (
            <div className="mx-6 my-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={14} className="text-amber-900" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">E-Way Bill required</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Invoice total {INR(total)} &ge; ₹{threshold.toLocaleString("en-IN")} — GST Rule 138 mandates an E-Way Bill
                </p>
              </div>
              <button
                onClick={() => setDrawer(true)}
                className="shrink-0 px-4 py-2 bg-amber-500 text-amber-950 rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center gap-1.5"
              >
                <Truck size={13} /> Generate now
              </button>
            </div>
          )}

          {/* Narration */}
          <div className="px-6 pb-4">
            <label className="text-xs text-gray-500 block mb-1">Narration (optional)</label>
            <input
              value={narration}
              onChange={(e) => setNarr(e.target.value)}
              placeholder="e.g. Sale of goods as per order PO-2024-042"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              {ewayRequired ? "Save & Generate E-Way Bill" : "Save invoice"}
            </button>
            <button className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Print
            </button>
            <button className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Send email
            </button>
            <button className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              WhatsApp
            </button>
            <span className="ml-auto text-xs text-gray-400">
              E-Way Bill threshold: <span className="font-semibold text-gray-600">₹50,000</span>
            </span>
          </div>
        </div>
      </div>

      {/* E-Way Bill Drawer */}
      <EWayBillDrawer
        open={drawerOpen}
        invoiceTotal={total}
        partyName={partyName}
        partyGstin={gstin}
        invoiceNo={invoiceNo}
        onClose={() => setDrawer(false)}
        onSubmit={submit}
      />
    </div>
  );
}
