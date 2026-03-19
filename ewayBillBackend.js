// ============================================================
// ewayBillRoute.js  —  Express route
// POST /api/v1/vouchers/:id/eway-bill
// ============================================================

const express  = require("express");
const router   = express.Router();
const { generateEwayBill } = require("./ewayBillService");
const { authenticateJWT }  = require("../middleware/auth");

router.post("/:id/eway-bill", authenticateJWT, async (req, res) => {
  try {
    const { id: voucherId }    = req.params;
    const { id: userId, orgId } = req.user;
    const transportDetails      = req.body;

    const result = await generateEwayBill(voucherId, transportDetails, userId, orgId);
    return res.json(result);
  } catch (err) {
    console.error("[EwayBill] Error:", err.message);
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;


// ============================================================
// ewayBillService.js  —  Core service
// Decrypts NIC credentials → builds payload → calls NIC API
// ============================================================

const { PrismaClient } = require("@prisma/client");
const axios            = require("axios");
const { decryptCredential } = require("../utils/credentialVault");
const { getSecret }         = require("../utils/secretManager");

const prisma = new PrismaClient();

const EWAY_THRESHOLD = 50000; // >= ₹50,000 requires E-Way Bill

async function generateEwayBill(voucherId, transportDetails, userId, orgId) {

  // ── 1. Load voucher ──────────────────────────────────────
  const voucher = await prisma.vouchers.findFirst({
    where: { id: voucherId, organization_id: orgId },
    include: {
      voucher_line_items: { include: { ledger: true, stock_item: true } },
      party_ledger:  true,
      organizations: true,
    },
  });

  if (!voucher)
    throw new Error("Voucher not found");

  // ── KEY CHECK: total >= ₹50,000 ─────────────────────────
  if (Number(voucher.total_amount) < EWAY_THRESHOLD)
    throw new Error(`E-Way Bill not required — total ₹${voucher.total_amount} is below ₹${EWAY_THRESHOLD.toLocaleString("en-IN")}`);

  if (voucher.eway_bill_status === "generated")
    throw new Error("E-Way Bill already generated for this voucher");

  // ── 2. Load encrypted NIC credentials ───────────────────
  const creds = await prisma.encrypted_credentials.findFirst({
    where: { organization_id: orgId, service: "eway_nic" },
  });

  if (!creds)
    throw new Error("NIC credentials not configured. Go to Settings → Integrations → E-Way Bill.");

  // ── 3. Decrypt credentials (AES-256-GCM) ────────────────
  const aesKey   = await getSecret("tallycloud-aes-key");
  const username = decryptCredential(creds.username_enc, creds.iv, creds.auth_tag, aesKey);
  const password = decryptCredential(creds.password_enc, creds.iv, creds.auth_tag, aesKey);

  // ── 4. Authenticate with NIC API ─────────────────────────
  const clientId     = await getSecret("mastergst-client-id");
  const clientSecret = await getSecret("mastergst-client-secret");
  const appGstin     = await getSecret("mastergst-gstin");

  const authRes = await axios.post(
    "https://api.mastergst.com/ewaybillapi/v1.03/ewayapi",
    { action: "GETUSERDETAILS", username, password },
    { headers: { "Content-Type": "application/json", gstin: appGstin, client_id: clientId, client_secret: clientSecret } }
  );

  const authToken = authRes.data?.result?.authToken;
  if (!authToken)
    throw new Error("NIC authentication failed. Please check your E-Way Bill credentials in Settings.");

  // ── 5. Build E-Way Bill JSON payload ─────────────────────
  const itemList = voucher.voucher_line_items.map((item) => ({
    productName:   item.stock_item?.name || item.ledger?.name || "Goods",
    hsnCode:       item.stock_item?.hsn_code || "9999",
    quantity:      parseFloat(item.quantity) || 1,
    qtyUnit:       item.stock_item?.unit || "NOS",
    taxableAmount: parseFloat(item.amount),
    sgstRate:      item.gst_rate ? item.gst_rate / 2 : 0,
    cgstRate:      item.gst_rate ? item.gst_rate / 2 : 0,
    igstRate:      0,
    cessRate:      0,
  }));

  const ewbPayload = {
    supplyType:      "O",
    subSupplyType:   "1",
    docType:         "INV",
    docNo:           voucher.voucher_number,
    docDate:         new Date(voucher.date).toLocaleDateString("en-IN").replace(/\//g, "/"),
    fromGstin:       voucher.organizations.gstin,
    fromTrdName:     voucher.organizations.name,
    fromAddr1:       "Seller Address Line 1",
    fromPlace:       "Delhi",
    fromPincode:     110001,
    fromStateCode:   7,
    toGstin:         voucher.party_ledger?.gstin || "URP",
    toTrdName:       voucher.party_ledger?.name,
    toAddr1:         "Buyer Address Line 1",
    toPlace:         "Mumbai",
    toPincode:       400001,
    toStateCode:     27,
    transactionType: 1,
    totalValue:      parseFloat(voucher.total_amount),
    cgstValue:       parseFloat(voucher.cgst_amount  || 0),
    sgstValue:       parseFloat(voucher.sgst_amount  || 0),
    igstValue:       parseFloat(voucher.igst_amount  || 0),
    cessValue:       0,
    transporterName: transportDetails.transName    || null,
    transMode:       transportDetails.transMode    || "1",
    transDistance:   parseInt(transportDetails.distance) || 0,
    vehicleNo:       transportDetails.vehicleNo    || null,
    vehicleType:     "R",
    itemList,
  };

  // ── 6. Submit to NIC API ─────────────────────────────────
  const ewbRes = await axios.post(
    "https://api.mastergst.com/ewaybillapi/v1.03/ewayapi",
    { action: "GENEWBBULK", username, password, ewbPayload: JSON.stringify(ewbPayload) },
    { headers: { "Content-Type": "application/json", authToken, gstin: appGstin, client_id: clientId, client_secret: clientSecret } }
  );

  const ewbNo = ewbRes.data?.result?.ewbNo;
  if (!ewbNo) {
    const nicErr = ewbRes.data?.message || "Unknown NIC error";
    throw new Error(`NIC rejected the request: ${nicErr}`);
  }

  // ── 7. Save EWB number to DB ─────────────────────────────
  await prisma.vouchers.update({
    where: { id: voucherId },
    data: {
      eway_bill_number: String(ewbNo),
      eway_bill_status: "generated",
    },
  });

  // ── 8. Audit log ─────────────────────────────────────────
  await prisma.audit_logs.create({
    data: {
      organization_id: orgId,
      user_id:         userId,
      action:          "EWAY_GENERATED",
      resource_type:   "voucher",
      resource_id:     voucherId,
      diff:            { ewbNo, voucherTotal: voucher.total_amount },
    },
  });

  // ── 9. Queue Drive PDF re-upload (includes EWB number) ───
  const { enqueueVoucherBackup } = require("../workers/driveQueue");
  await enqueueVoucherBackup(voucherId, orgId, true);

  return { ewbNo, message: "E-Way Bill generated successfully" };
}

module.exports = { generateEwayBill };


// ============================================================
// credentialVault.js  —  AES-256-GCM encrypt / decrypt
// ============================================================

const crypto = require("crypto");
const ALGO   = "aes-256-gcm";

/**
 * encryptCredential
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns { ciphertext (base64), iv (hex), authTag (hex) }
 */
function encryptCredential(plaintext, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("AES key must be 32 bytes (64 hex chars)");

  const iv     = crypto.randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag(); // 128-bit GCM auth tag

  return {
    ciphertext: encrypted.toString("base64"),
    iv:         iv.toString("hex"),
    authTag:    authTag.toString("hex"),
  };
}

/**
 * decryptCredential
 * Decrypts AES-256-GCM ciphertext.
 * Throws if auth tag fails (tamper detection).
 */
function decryptCredential(ciphertext, ivHex, authTagHex, keyHex) {
  const key       = Buffer.from(keyHex, "hex");
  const iv        = Buffer.from(ivHex, "hex");
  const authTag   = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(ciphertext, "base64");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag); // Throws if tampered

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { encryptCredential, decryptCredential };


// ============================================================
// secretManager.js  —  Google Secret Manager helper
// Secrets are NEVER stored in .env in production.
// ============================================================

const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

const client     = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const cache      = new Map(); // in-process cache (per Cloud Run instance lifetime)

async function getSecret(name, version = "latest") {
  const key = `${name}@${version}`;
  if (cache.has(key)) return cache.get(key);

  const [sv] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${name}/versions/${version}`,
  });

  const value = sv.payload.data.toString("utf8").trim();
  cache.set(key, value);
  return value;
}

module.exports = { getSecret };
