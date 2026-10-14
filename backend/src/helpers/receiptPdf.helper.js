/**
 * Builds a one-page A4 PDF payment receipt for a service job.
 *
 * Written against the PDF 1.4 spec directly (standard Helvetica fonts, a few
 * rectangles and the logo image) so the backend needs no PDF library.
 * The standard fonts use WinAnsi encoding, which has no rupee sign, so
 * amounts are printed as "Rs.".
 */
const zlib = require('zlib');
const logo = require('../assets/receiptLogo');

// Helvetica glyph widths (1/1000 em) for ASCII 32..126, from the standard AFM
const HELVETICA_WIDTHS = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

const HELVETICA_BOLD_WIDTHS = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

const textWidth = (str, size, bold = false) => {
    const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
    let units = 0;
    for (const ch of str) {
        const code = ch.charCodeAt(0);
        units += (code >= 32 && code <= 126) ? widths[code - 32] : 556;
    }
    return (units * size) / 1000;
};

// Keep Latin-1 characters (WinAnsi covers them); anything else becomes '?'
const toWinAnsi = (str) => String(str ?? '').replace(/[^\x20-\xFF]/g, '?');
const escapePdf = (str) => toWinAnsi(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => d
    ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

const rgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255).toFixed(3)).join(' ');
};

/**
 * Lays out a receipt page. Every receipt (job payment, wallet transaction) uses
 * the same structure so they look like one family of documents.
 *
 * @param {object} r
 * @param {string} r.title          e.g. 'PAYMENT RECEIPT'
 * @param {string} r.receiptNo
 * @param {Date}   r.date
 * @param {string} r.statusLabel    e.g. 'PAID', 'CREDITED'
 * @param {'ok'|'warn'|'bad'} r.statusTone
 * @param {string} r.headline       e.g. 'Amount paid: Rs. 473.60'
 * @param {Array<{label, name, lines}>} r.parties  one or two columns
 * @param {Array<[string, string]>} r.details
 * @param {Array<[string, string, number]>} r.charges  label, sub-label, amount
 * @param {string} r.totalLabel
 * @param {number} r.totalAmount
 * @param {string} [r.note]         one line under the total
 * @returns {Buffer}
 */
const buildReceiptPdf = (r) => {
    const W = 595, H = 842, M = 48;
    const ops = [];

    const fill = (hex) => ops.push(`${rgb(hex)} rg`);
    const stroke = (hex) => ops.push(`${rgb(hex)} RG`);
    const rect = (x, y, w, h, hex) => { fill(hex); ops.push(`${x} ${y} ${w} ${h} re f`); };
    const line = (x1, y1, x2, y2, hex = '#E2E8F0', width = 1) => {
        stroke(hex); ops.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const text = (str, x, y, { size = 10, bold = false, color = '#1E293B', align = 'left' } = {}) => {
        const s = toWinAnsi(str);
        let tx = x;
        if (align === 'right') tx = x - textWidth(s, size, bold);
        if (align === 'center') tx = x - textWidth(s, size, bold) / 2;
        fill(color);
        ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(s)}) Tj ET`);
    };
    const clip = (str, max) => { const s = String(str ?? ''); return s.length > max ? `${s.slice(0, max - 3)}...` : s; };

    // ── Header band ──
    rect(0, H - 120, W, 120, '#6C47FF');
    const logoH = 62, logoW = Math.round(logoH * logo.width / logo.height);
    rect(M - 8, H - 98, logoW + 16, logoH + 14, '#FFFFFF');
    ops.push(`q ${logoW} 0 0 ${logoH} ${M} ${H - 91} cm /Im1 Do Q`);
    text('Kwickly', M + logoW + 22, H - 58, { size: 26, bold: true, color: '#FFFFFF' });
    text('Local services & shops, delivered quickly', M + logoW + 22, H - 76, { size: 10, color: '#E0D7FF' });
    text(r.title, W - M, H - 52, { size: 15, bold: true, color: '#FFFFFF', align: 'right' });
    text(`Receipt No: ${r.receiptNo}`, W - M, H - 70, { size: 9.5, color: '#E0D7FF', align: 'right' });
    text(`Date: ${formatDate(r.date)}`, W - M, H - 84, { size: 9.5, color: '#E0D7FF', align: 'right' });

    // ── Status pill + headline ──
    let y = H - 160;
    const tones = { ok: ['#D1FAE5', '#047857'], warn: ['#FEF3C7', '#B45309'], bad: ['#FEE2E2', '#B91C1C'] };
    const [pillBg, pillFg] = tones[r.statusTone] || tones.warn;
    const pillW = Math.max(86, textWidth(r.statusLabel, 10, true) + 24);
    rect(M, y - 6, pillW, 22, pillBg);
    text(r.statusLabel, M + pillW / 2, y + 1, { size: 10, bold: true, color: pillFg, align: 'center' });
    text(r.headline, W - M, y + 1, { size: 13, bold: true, align: 'right' });

    // ── Parties ──
    y -= 48;
    const colX = [M, W / 2 + 10];
    (r.parties || []).slice(0, 2).forEach((p, i) => {
        const x = colX[i];
        text(p.label, x, y, { size: 8.5, bold: true, color: '#64748B' });
        text(clip(p.name || '-', 34), x, y - 16, { size: 12, bold: true });
        (p.lines || []).filter(Boolean).slice(0, 2).forEach((l, j) => {
            text(clip(l, 46), x, y - 31 - j * 14, { size: 9.5, color: '#475569' });
        });
    });

    // ── Details ──
    y -= 80;
    line(M, y + 14, W - M, y + 14);
    const details = (r.details || []).filter(([, v]) => v !== undefined && v !== null && v !== '');
    details.forEach(([k, v], i) => {
        const ry = y - 6 - i * 20;
        text(k, M, ry, { size: 10, color: '#64748B' });
        text(clip(v, 60), M + 130, ry, { size: 10, bold: true });
    });

    // ── Charges table ──
    y = y - 6 - details.length * 20 - 24;
    rect(M, y - 4, W - 2 * M, 24, '#F1F5F9');
    text('DESCRIPTION', M + 12, y + 4, { size: 9, bold: true, color: '#475569' });
    text('AMOUNT', W - M - 12, y + 4, { size: 9, bold: true, color: '#475569', align: 'right' });
    const rows = r.charges || [];
    rows.forEach(([label, sub, amt], i) => {
        const ry = y - 28 - i * 36;
        text(clip(label, 60), M + 12, ry, { size: 11, bold: true });
        if (sub) text(clip(sub, 80), M + 12, ry - 13, { size: 8.5, color: '#64748B' });
        text(money(amt), W - M - 12, ry - 4, { size: 11, align: 'right' });
        line(M, ry - 22, W - M, ry - 22);
    });

    y = y - 28 - rows.length * 36 - 18;
    rect(M, y - 10, W - 2 * M, 34, '#6C47FF');
    text(r.totalLabel, M + 12, y + 2, { size: 12, bold: true, color: '#FFFFFF' });
    text(money(r.totalAmount), W - M - 12, y + 2, { size: 14, bold: true, color: '#FFFFFF', align: 'right' });
    if (r.note) text(clip(r.note, 95), M, y - 30, { size: 9.5, color: '#475569' });

    // ── Footer ──
    line(M, 92, W - M, 92);
    text('Thank you for choosing Kwickly.', W / 2, 74, { size: 10.5, bold: true, color: '#6C47FF', align: 'center' });
    text('This is a computer-generated receipt and does not require a signature.', W / 2, 58, { size: 8.5, color: '#64748B', align: 'center' });
    text(`Generated on ${formatDate(new Date())}`, W / 2, 45, { size: 8, color: '#94A3B8', align: 'center' });

    const content = Buffer.from(ops.join('\n'), 'latin1');

    // ── Assemble objects ──
    const objects = [];
    objects[1] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>');
    objects[2] = Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects[3] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> >>`);
    const deflated = zlib.deflateSync(content);
    objects[4] = Buffer.concat([Buffer.from(`<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n`), deflated, Buffer.from('\nendstream')]);
    objects[5] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects[6] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const rgbData = Buffer.from(logo.rgb, 'base64');
    const alphaData = Buffer.from(logo.alpha, 'base64');
    objects[7] = Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 8 0 R /Length ${rgbData.length} >>\nstream\n`),
        rgbData, Buffer.from('\nendstream')
    ]);
    objects[8] = Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaData.length} >>\nstream\n`),
        alphaData, Buffer.from('\nendstream')
    ]);

    const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets = [];
    let pos = parts[0].length;
    for (let i = 1; i < objects.length; i++) {
        offsets[i] = pos;
        const chunk = Buffer.concat([Buffer.from(`${i} 0 obj\n`), objects[i], Buffer.from('\nendobj\n')]);
        parts.push(chunk);
        pos += chunk.length;
    }
    const xref = ['xref', `0 ${objects.length}`, '0000000000 65535 f ']
        .concat(offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n `))
        .join('\n');
    parts.push(Buffer.from(`${xref}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
    return Buffer.concat(parts);
};

const shortId = (id) => String(id || '').slice(-8).toUpperCase();

const METHOD_LABELS = { WALLET: 'Kwickly Wallet', CASH: 'Cash', UPI: 'UPI (direct bank transfer)' };

/** Receipt for a customer's payment of a service job. */
const jobReceiptData = (job, paidAt) => {
    const p = job.payment || {};
    const paid = p.status === 'PAID';
    const amount = p.amount || 0;
    return {
        title: 'PAYMENT RECEIPT',
        receiptNo: `KW-JOB-${shortId(job._id)}`,
        date: paidAt || job.completionDetails?.completedAt || job.updatedAt,
        statusLabel: paid ? 'PAID' : (p.status || 'PENDING'),
        statusTone: paid ? 'ok' : 'warn',
        headline: `${paid ? 'Amount paid' : 'Amount due'}: ${money(amount)}`,
        parties: [
            {
                label: 'BILLED TO',
                name: job.customerId?.name || 'Customer',
                lines: [job.customerId?.phone && `Phone: ${job.customerId.phone}`, job.addressDetails?.fullAddress]
            },
            { label: 'SERVICE PROVIDER', name: job.workerId?.name || '-', lines: ['Verified Kwickly partner'] }
        ],
        details: [
            ['Service', [job.category, job.subcategory].filter(Boolean).join(' - ') || '-'],
            ['Job ID', `#${shortId(job._id)}`],
            ['Work completed', formatDate(job.completionDetails?.completedAt)],
            ['Payment method', METHOD_LABELS[p.method] || p.method || '-']
        ],
        charges: [
            ['Service charge', 'Paid in full to the service provider', p.workerPayout],
            ['Platform fee', 'Kwickly convenience fee', p.platformFee],
            ['GST @ 18%', 'On platform fee only', p.gst || p.gstAmount]
        ],
        totalLabel: paid ? 'TOTAL PAID' : 'TOTAL DUE',
        totalAmount: amount
    };
};

const CREDIT_TYPES = ['JOB_CREDIT', 'REFUND', 'ORDER_CREDIT', 'REFERRAL_BONUS', 'TOPUP', 'TRANSFER_RECEIVED'];

const TXN_LABELS = {
    JOB_CREDIT: 'Job earnings',
    JOB_DEBIT: 'Platform commission',
    SUBSCRIPTION: 'Subscription plan',
    WITHDRAWAL: 'Withdrawal to bank / UPI',
    REFUND: 'Refund',
    ORDER_CREDIT: 'Order earnings',
    ORDER_DEBIT: 'Platform commission',
    REFERRAL_BONUS: 'Referral bonus',
    ADJUSTMENT: 'Adjustment by Kwickly',
    TOPUP: 'Wallet top-up',
    ORDER_PAYMENT: 'Shop order payment',
    JOB_PAYMENT: 'Service job payment',
    TRANSFER_SENT: 'Wallet transfer sent',
    TRANSFER_RECEIVED: 'Wallet transfer received'
};

const txnIsCredit = (txn) => CREDIT_TYPES.includes(txn.type)
    || (txn.type === 'ADJUSTMENT' && !/debit/i.test(txn.description || ''));

const txnPaymentMode = (txn) => {
    if (txn.type === 'TOPUP') return 'UPI (direct bank transfer)';
    if (txn.type === 'WITHDRAWAL') return 'Bank / UPI payout';
    if (txn.type?.startsWith('TRANSFER')) return 'Kwickly Wallet transfer';
    return 'Kwickly Wallet';
};

const ROLE_LABELS = { CUSTOMER: 'Customer', WORKER: 'Service partner', SHOP: 'Shop partner', DELIVERY: 'Delivery partner', ADMIN: 'Admin' };

/** Receipt for one wallet transaction (any role). */
const walletReceiptData = (txn, user) => {
    const credit = txnIsCredit(txn);
    const label = TXN_LABELS[txn.type] || txn.type;
    const statusLabel = txn.status === 'COMPLETED' ? (credit ? 'CREDITED' : 'DEBITED') : (txn.status || 'PENDING');
    const tone = txn.status === 'FAILED' ? 'bad' : (txn.status === 'COMPLETED' ? 'ok' : 'warn');
    const reference = txn.gatewayTransactionId || txn.razorpayPaymentId || txn.refId;
    const counterparty = txn.counterpartyName
        ? [txn.type === 'TRANSFER_SENT' ? 'Sent to' : 'Received from', txn.counterpartyName]
        : null;
    return {
        title: 'TRANSACTION RECEIPT',
        receiptNo: `KW-TXN-${shortId(txn._id)}`,
        date: txn.verifiedAt || txn.createdAt,
        statusLabel,
        statusTone: tone,
        headline: `${credit ? 'Credited' : 'Debited'}: ${money(txn.amount)}`,
        parties: [{
            label: 'ACCOUNT HOLDER',
            name: user?.name || 'Kwickly user',
            lines: [user?.phone && `Phone: ${user.phone}`, ROLE_LABELS[user?.role]]
        }],
        details: [
            ['Transaction', label],
            ['Description', txn.description],
            counterparty,
            ['Payment mode', txnPaymentMode(txn)],
            ['Reference', reference && (/^[a-f0-9]{24}$/i.test(reference) ? `#${shortId(reference)}` : reference)],
            ['Transaction ID', String(txn._id)]
        ].filter(Boolean),
        charges: [[label, credit ? 'Added to your Kwickly wallet' : 'Deducted from your Kwickly wallet', txn.amount]],
        totalLabel: credit ? 'AMOUNT CREDITED' : 'AMOUNT DEBITED',
        totalAmount: txn.amount,
        note: `Wallet balance after this transaction: ${money(txn.balance)}`
    };
};

module.exports = { buildReceiptPdf, jobReceiptData, walletReceiptData, txnIsCredit };
