// ============================================================
// useEwayBill.js  —  React Hook
// Monitors invoice total. Fires when total >= ₹50,000.
// Usage:
//   const { total, ewayRequired, submit, status, ewbNo } = useEwayBill(lineItems, voucherId);
// ============================================================

import { useState, useEffect, useCallback } from "react";

const EWAY_THRESHOLD = 50000; // >= ₹50,000 triggers E-Way Bill

export function useEwayBill(lineItems = [], voucherId = null) {
  const [total, setTotal]               = useState(0);
  const [subtotal, setSubtotal]         = useState(0);
  const [cgst, setCgst]                 = useState(0);
  const [sgst, setSgst]                 = useState(0);
  const [igst, setIgst]                 = useState(0);
  const [ewayRequired, setEwayRequired] = useState(false);
  const [status, setStatus]             = useState("idle"); // idle | loading | success | error
  const [ewbNo, setEwbNo]               = useState(null);
  const [error, setError]               = useState(null);

  // Recalculate totals whenever line items change
  useEffect(() => {
    let sub = 0, c = 0, s = 0, ig = 0;

    lineItems.forEach((item) => {
      const base     = parseFloat(item.amount)      || 0;
      const cgstAmt  = parseFloat(item.cgst_amount) || 0;
      const sgstAmt  = parseFloat(item.sgst_amount) || 0;
      const igstAmt  = parseFloat(item.igst_amount) || 0;
      sub += base;
      c   += cgstAmt;
      s   += sgstAmt;
      ig  += igstAmt;
    });

    const grandTotal = sub + c + s + ig;

    setSubtotal(Math.round(sub  * 100) / 100);
    setCgst    (Math.round(c    * 100) / 100);
    setSgst    (Math.round(s    * 100) / 100);
    setIgst    (Math.round(ig   * 100) / 100);
    setTotal   (Math.round(grandTotal * 100) / 100);

    // KEY RULE: E-Way Bill required when total >= ₹50,000
    setEwayRequired(grandTotal >= EWAY_THRESHOLD);
  }, [lineItems]);

  // Submit E-Way Bill to backend → NIC API
  const submit = useCallback(
    async (transportDetails) => {
      if (!voucherId)    throw new Error("Voucher ID required");
      if (!ewayRequired) return; // safety guard — should never reach here

      setStatus("loading");
      setError(null);

      try {
        const res = await fetch(`/api/v1/vouchers/${voucherId}/eway-bill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("tc_token")}`,
          },
          body: JSON.stringify(transportDetails),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "E-Way Bill generation failed");
        }

        const data = await res.json();
        setEwbNo(data.ewbNo);
        setStatus("success");
        return data;
      } catch (err) {
        setError(err.message);
        setStatus("error");
        throw err;
      }
    },
    [voucherId, ewayRequired]
  );

  return {
    total,
    subtotal,
    cgst,
    sgst,
    igst,
    ewayRequired,
    threshold: EWAY_THRESHOLD,
    status,
    ewbNo,
    error,
    submit,
  };
}
