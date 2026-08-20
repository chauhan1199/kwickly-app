/**
 * Unified Platform Fee & Commission Calculator for Kwickly Platform
 * 
 * Supports:
 * - 'tiered' (Default): Flat minimum fee under threshold, percentage above threshold (e.g. ₹50 under ₹500, 12% above ₹500).
 * - 'percent': Fixed percentage on total quote.
 * - 'flat': Fixed flat fee regardless of amount.
 */

function calculatePlatformFee(quoteAmount, feeConfig = {}) {
    const workerPayout = Number(quoteAmount) || 0;
    const type = feeConfig.type || 'tiered';
    const gstPct = feeConfig.gstPercentage !== undefined ? Number(feeConfig.gstPercentage) : 18;

    let platformFee = 0;

    if (type === 'tiered') {
        const threshold = feeConfig.threshold !== undefined ? Number(feeConfig.threshold) : (feeConfig.feeThreshold !== undefined ? Number(feeConfig.feeThreshold) : 500);
        const minFee = feeConfig.minFee !== undefined ? Number(feeConfig.minFee) : (feeConfig.feeMinAmount !== undefined ? Number(feeConfig.feeMinAmount) : (feeConfig.amount || 50));
        const percentage = feeConfig.percentage !== undefined ? Number(feeConfig.percentage) : (feeConfig.feePercentage !== undefined ? Number(feeConfig.feePercentage) : 12);

        if (workerPayout <= threshold) {
            platformFee = minFee;
        } else {
            platformFee = Math.round((workerPayout * percentage) / 100);
            if (platformFee < minFee) platformFee = minFee;
        }
    } else if (type === 'percent' || type === 'percentage') {
        const pct = feeConfig.percentage || feeConfig.feePercentage || feeConfig.amount || 12;
        platformFee = Math.round((workerPayout * pct) / 100);
    } else { // flat
        platformFee = feeConfig.minFee || feeConfig.feeMinAmount || feeConfig.amount || 50;
    }

    const gst = Math.round((platformFee * gstPct) / 100);
    const customerPayable = workerPayout + platformFee + gst;

    return {
        workerPayout,
        platformFee,
        gst,
        customerPayable,
        gstPercentage: gstPct
    };
}

module.exports = { calculatePlatformFee };
