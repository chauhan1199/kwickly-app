import { Share, NativeModules, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { KWICKLY_LOGO_BASE64 } from '../assets/logoBase64';
import api from '../services/api';

const { NativeUpiPayment } = NativeModules;

const formatReceiptDate = (raw) => {
  try {
    const d = new Date(raw || Date.now());
    if (isNaN(d.getTime())) return 'Recent';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    return 'Recent';
  }
};

const CREDIT_TYPES = ['JOB_CREDIT', 'REFUND', 'ORDER_CREDIT', 'REFERRAL_BONUS', 'TOPUP', 'TRANSFER_RECEIVED', 'CREDIT'];
export const isCreditTxn = (txn) => CREDIT_TYPES.includes(txn?.type)
  || (txn?.type === 'ADJUSTMENT' && !/debit/i.test(txn?.description || ''));

export const paymentModeFor = (txn) => {
  if (txn?.type === 'TOPUP') return 'UPI (direct bank transfer)';
  if (txn?.type === 'WITHDRAWAL') return 'Bank / UPI payout';
  if (txn?.type?.startsWith('TRANSFER')) return 'Kwickly Wallet transfer';
  return 'Kwickly Wallet';
};

const isMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ''));

/**
 * Fetches a receipt PDF the server built ({ fileName, pdfBase64 }) and opens the
 * Android share sheet with the real .pdf file. Returns null when that isn't possible
 * so callers can fall back to a text receipt.
 */
const shareServerPdf = async (url) => {
  if (Platform.OS !== 'android' || !NativeUpiPayment?.sharePdfBase64) return null;
  try {
    const res = await api.get(url);
    const { fileName, pdfBase64 } = res?.data?.data || {};
    if (!pdfBase64) return null;
    const path = await NativeUpiPayment.sharePdfBase64({ base64: pdfBase64, fileName, title: 'Kwickly Receipt' });
    return { action: 'SHARED_PDF', path };
  } catch (e) {
    console.warn('Server PDF receipt failed:', e?.message);
    return null;
  }
};

/** Shares the official PDF receipt for a paid service job (customer side). */
export const shareJobReceiptPdf = (jobId) => shareServerPdf(`/customers/jobs/${jobId}/receipt-pdf`);

/**
 * Formats a clean, official transaction receipt string without private payer data or generic website/email.
 */
export const formatOfficialReceiptText = (txn) => {
  if (!txn) return '';
  const rawId = String(txn._id || txn.id || 'TXN');
  const receiptId = `KWIK-RCPT-${rawId.slice(-8).toUpperCase() || 'TXN'}`;
  const dateStr = formatReceiptDate(txn.createdAt || txn.txnDate);
  const refId = txn.razorpayPaymentId || txn.gatewayTransactionId || txn.refId || txn.utrNumber || txn.paymentId || '-';
  const amountStr = `${isCreditTxn(txn) ? '+' : '-'}₹${Math.abs(txn.amount || 0)}`;
  const balanceStr = `₹${txn.balance ?? txn.balanceAfter ?? 0}`;

  return `
========================================
       KWICKLY OFFICIAL PAYMENT RECEIPT
========================================
Receipt ID    : ${receiptId}
Date & Time   : ${dateStr}
Status        : ${txn.status || 'COMPLETED'}
----------------------------------------
Transaction Details:
Description   : ${txn.description || txn.type || '-'}
Type          : ${txn.type || '-'}
Payment Mode  : ${paymentModeFor(txn)}
Reference/UTR : ${refId}
----------------------------------------
Amount Paid   : ${amountStr}
Balance after : ${balanceStr}
========================================
`.trim();
};

/**
 * Generates an actual .pdf document file and opens the native Share sheet (WhatsApp, Drive, Gmail, etc.)
 */
export const shareOfficialReceipt = async (txn) => {
  if (!txn) return;
  const rawId = String(txn._id || txn.id || 'TXN');
  const receiptId = `KWIK-RCPT-${rawId.slice(-8).toUpperCase() || 'TXN'}`;

  if (isMongoId(rawId)) {
    const shared = await shareServerPdf(`/wallet/transactions/${rawId}/receipt-pdf`);
    if (shared) return shared;
  }

  // Fallback to text share
  const receiptText = formatOfficialReceiptText(txn);
  try {
    const result = await Share.share({
      title: `Kwickly Payment Receipt - ${receiptId}`,
      message: receiptText,
    });
    return result;
  } catch (err) {
    Clipboard.setString(receiptText);
    return { action: 'COPIED', text: receiptText };
  }
};

/**
 * Opens system print / Save as PDF dialog
 */
export const printReceiptPdf = async (txn) => {
  if (!txn) return;
  const rawId = String(txn._id || txn.id || 'TXN');
  const receiptId = `KWIK-RCPT-${rawId.slice(-8).toUpperCase() || 'TXN'}`;
  const dateStr = formatReceiptDate(txn.createdAt || txn.txnDate);

  const refId = txn.razorpayPaymentId || txn.gatewayTransactionId || txn.refId || txn.utrNumber || txn.paymentId || '-';
  const isCr = isCreditTxn(txn);
  const amountStr = `${isCr ? '+' : '-'}₹${Math.abs(txn.amount || 0)}`;
  const balanceStr = `₹${txn.balance ?? txn.balanceAfter ?? 0}`;
  const type = txn.type || 'TRANSACTION';
  const description = txn.description || type;
  const status = txn.status || 'COMPLETED';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kwickly Receipt - ${receiptId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #F8FAFC; color: #0F172A; }
    .receipt-container { max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #6C47FF 0%, #4F46E5 100%); padding: 22px 24px; color: #FFFFFF; position: relative; display: flex; justify-content: space-between; align-items: center; }
    .brand-row { display: flex; align-items: center; gap: 14px; }
    .logo-box { width: 50px; height: 50px; background: #FFFFFF; border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.12); }
    .logo-img { width: 42px; height: 42px; object-fit: contain; }
    .brand { font-size: 26px; font-weight: 900; letter-spacing: -0.4px; line-height: 1.1; }
    .subtitle { font-size: 10px; font-weight: 700; color: #E0E7FF; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.8px; }
    .badge { background: #10B981; color: #FFFFFF; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; white-space: nowrap; }
    .amount-box { padding: 24px; text-align: center; border-bottom: 1px dashed #E2E8F0; }
    .desc { font-size: 13px; color: #64748B; font-weight: 600; margin-bottom: 6px; }
    .amount { font-size: 36px; font-weight: 900; color: ${isCr ? '#059669' : '#DC2626'}; letter-spacing: -1px; margin-bottom: 8px; }
    .status-pill { display: inline-block; background: #D1FAE5; color: #059669; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; }
    .details-table { padding: 20px 24px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .key { color: #64748B; font-weight: 600; }
    .val { color: #0F172A; font-weight: 700; text-align: right; }
    .val-highlight { color: #6C47FF; font-weight: 800; }
    .val-balance { color: #059669; font-size: 15px; font-weight: 900; }
    .footer { padding: 16px 24px 24px; text-align: center; font-size: 10.5px; color: #94A3B8; border-top: 1px solid #F1F5F9; }
    @media print { body { background: #FFFFFF; padding: 0; } .receipt-container { box-shadow: none; border: none; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="brand-row">
        <div class="logo-box">
          <img class="logo-img" src="${KWICKLY_LOGO_BASE64}" alt="Kwickly Logo" />
        </div>
        <div>
          <div class="brand">Kwick<span style="color:#C4B5FD">ly</span></div>
          <div class="subtitle">Transaction Receipt</div>
        </div>
      </div>
      <div class="badge">${isCr ? 'CREDITED' : 'DEBITED'}</div>
    </div>
    <div class="amount-box">
      <div class="desc">${description}</div>
      <div class="amount">${amountStr}</div>
      <div class="status-pill">${status}</div>
    </div>
    <div class="details-table">
      <div class="row"><span class="key">Receipt ID</span><span class="val val-highlight">${receiptId}</span></div>
      <div class="row"><span class="key">Date & Time</span><span class="val">${dateStr}</span></div>
      <div class="row"><span class="key">Transaction Type</span><span class="val">${type}</span></div>
      <div class="row"><span class="key">Payment Mode</span><span class="val">${paymentModeFor(txn)}</span></div>
      <div class="row"><span class="key">Reference / UTR</span><span class="val val-highlight">${refId}</span></div>
      <div class="row"><span class="key" style="font-weight:800;color:#0F172A;">Balance after this transaction</span><span class="val val-balance">${balanceStr}</span></div>
    </div>
    <div class="footer">
      <div style="font-weight:700;color:#6C47FF;">Thank you for choosing Kwickly.</div>
      <div style="margin-top:4px;">This is a computer-generated receipt and does not require a signature.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  if (Platform.OS === 'android' && NativeUpiPayment?.printReceipt) {
    try {
      await NativeUpiPayment.printReceipt({
        receiptId,
        htmlContent,
      });
      return true;
    } catch (e) {
      console.warn('Native print error:', e);
    }
  }

  return shareOfficialReceipt(txn);
};

export const generateAndSharePdfReceipt = async (receiptData) => {
  return shareOfficialReceipt(receiptData);
};

export const formatReceiptData = (txn, user, balance) => {
  return {
    ...txn,
    // the receipt shows the balance right after this transaction, not today's balance
    balance: txn?.balance ?? balance,
  };
};
