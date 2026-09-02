import { Share, NativeModules, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

const { NativeUpiPayment } = NativeModules;

/**
 * Formats a clean, official transaction receipt string without private payer data or generic website/email.
 */
export const formatOfficialReceiptText = (txn) => {
  if (!txn) return '';
  const receiptId = `KWIK-RCPT-${(txn._id || '').slice(-8).toUpperCase() || 'TXN'}`;
  const dateStr = new Date(txn.createdAt || txn.txnDate || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const refId = txn.razorpayPaymentId || txn.gatewayTransactionId || txn.refId || txn.utrNumber || txn.paymentId || 'AUTO_VERIFIED';
  const isCr = txn.type === 'TOPUP' || txn.type === 'REFUND' || txn.type === 'CREDIT' || (txn.amount > 0 && !txn.type?.includes('DEBIT'));
  const amountStr = `${isCr ? '+' : '-'}₹${Math.abs(txn.amount || 0)}`;
  const balanceStr = `₹${txn.balance || txn.balanceAfter || 0}`;

  return `
========================================
       KWICKLY OFFICIAL PAYMENT RECEIPT
========================================
Receipt ID    : ${receiptId}
Date & Time   : ${dateStr}
Status        : ${txn.status || 'COMPLETED'}
----------------------------------------
Transaction Details:
Description   : ${txn.description || 'Wallet Top-up via Direct UPI (Verified)'}
Type          : ${txn.type || 'TOPUP'}
Payment Mode  : UPI / Direct Bank Transfer
Reference/UTR : ${refId}
----------------------------------------
Amount Paid   : ${amountStr}
Wallet Balance: ${balanceStr}
========================================
`.trim();
};

/**
 * Generates an actual .pdf document file and opens the native Share sheet (WhatsApp, Drive, Gmail, etc.)
 */
export const shareOfficialReceipt = async (txn) => {
  if (!txn) return;
  const receiptId = `KWIK-RCPT-${(txn._id || '').slice(-8).toUpperCase() || 'TXN'}`;
  const dateStr = new Date(txn.createdAt || txn.txnDate || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const refId = txn.razorpayPaymentId || txn.gatewayTransactionId || txn.refId || txn.utrNumber || txn.paymentId || 'AUTO_VERIFIED';
  const isCr = txn.type === 'TOPUP' || txn.type === 'REFUND' || txn.type === 'CREDIT' || (txn.amount > 0 && !txn.type?.includes('DEBIT'));
  const amountStr = `${isCr ? '+' : '-'}₹${Math.abs(txn.amount || 0)}`;
  const balanceStr = `₹${txn.balance || txn.balanceAfter || 0}`;
  const description = txn.description || 'Wallet Top-up via Direct UPI (Verified)';
  const status = txn.status || 'COMPLETED';
  const type = txn.type || 'TOPUP';

  if (Platform.OS === 'android' && NativeUpiPayment?.generateAndSharePdfReceipt) {
    try {
      const pdfPath = await NativeUpiPayment.generateAndSharePdfReceipt({
        receiptId,
        dateStr,
        status,
        description,
        type,
        paymentMode: 'UPI / Direct Bank Transfer',
        refId,
        amountStr,
        balanceStr,
      });
      return { action: 'SHARED_PDF', path: pdfPath };
    } catch (e) {
      console.warn('Native PDF share error, falling back to standard share:', e);
    }
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
  const receiptId = `KWIK-RCPT-${(txn._id || '').slice(-8).toUpperCase() || 'TXN'}`;
  const dateStr = new Date(txn.createdAt || txn.txnDate || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const refId = txn.razorpayPaymentId || txn.gatewayTransactionId || txn.refId || txn.utrNumber || txn.paymentId || 'AUTO_VERIFIED';
  const isCr = txn.type === 'TOPUP' || txn.type === 'REFUND' || txn.type === 'CREDIT' || (txn.amount > 0 && !txn.type?.includes('DEBIT'));
  const amountStr = `${isCr ? '+' : '-'}₹${Math.abs(txn.amount || 0)}`;
  const balanceStr = `₹${txn.balance || txn.balanceAfter || 0}`;
  const description = txn.description || 'Wallet Top-up via Direct UPI (Verified)';
  const status = txn.status || 'COMPLETED';
  const type = txn.type || 'TOPUP';

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
    .header { background: linear-gradient(135deg, #6C47FF 0%, #4F46E5 100%); padding: 24px; color: #FFFFFF; position: relative; }
    .brand { font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
    .subtitle { font-size: 11px; font-weight: 700; color: #E0E7FF; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.8px; }
    .badge { position: absolute; top: 24px; right: 24px; background: #10B981; color: #FFFFFF; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; }
    .amount-box { padding: 24px; text-align: center; border-bottom: 1px dashed #E2E8F0; }
    .desc { font-size: 13px; color: #64748B; font-weight: 600; margin-bottom: 6px; }
    .amount { font-size: 36px; font-weight: 900; color: #059669; letter-spacing: -1px; margin-bottom: 8px; }
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
      <div class="brand">KWICKLY</div>
      <div class="subtitle">Official Transaction Receipt & Audit Ledger</div>
      <div class="badge">✓ VERIFIED</div>
    </div>
    <div class="amount-box">
      <div class="desc">${description}</div>
      <div class="amount">${amountStr}</div>
      <div class="status-pill">● SUCCESSFUL • ${status}</div>
    </div>
    <div class="details-table">
      <div class="row"><span class="key">Receipt ID</span><span class="val val-highlight">${receiptId}</span></div>
      <div class="row"><span class="key">Date & Time</span><span class="val">${dateStr}</span></div>
      <div class="row"><span class="key">Transaction Type</span><span class="val">${type}</span></div>
      <div class="row"><span class="key">Payment Mode</span><span class="val">UPI / Direct Bank Transfer</span></div>
      <div class="row"><span class="key">Reference / UTR</span><span class="val val-highlight">${refId}</span></div>
      <div class="row"><span class="key" style="font-weight:800;color:#0F172A;">Wallet Balance</span><span class="val val-balance">${balanceStr}</span></div>
    </div>
    <div class="footer">
      <div>AUTHENTICATED BY KWICKLY SECURE LEDGER ENGINE • 100% VERIFIED</div>
      <div style="margin-top:4px;">This is an official computer-generated financial document.</div>
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
