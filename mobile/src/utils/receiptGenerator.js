import { Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

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
 * Shares or copies the official receipt.
 */
export const shareOfficialReceipt = async (txn) => {
  const receiptText = formatOfficialReceiptText(txn);
  const receiptId = `KWIK-RCPT-${(txn._id || '').slice(-8).toUpperCase() || 'TXN'}`;
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
