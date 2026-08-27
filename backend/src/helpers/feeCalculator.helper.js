/**
 * Kwickly Centralized Fee & GST Calculation Engine
 * Implements Admin-configurable Dynamic Tiered, Percentage, and Fixed Fee calculations
 */

const calculateJobFee = (workerQuoteAmount, config = {}) => {
    const quote = Math.max(0, Number(workerQuoteAmount) || 0);
    const mode = config.mode || 'TIERED'; // 'TIERED' | 'PERCENTAGE' | 'FIXED'
    const threshold = config.threshold !== undefined ? Number(config.threshold) : 500;
    const minFee = config.minFee !== undefined ? Number(config.minFee) : 50;
    const percentAboveThreshold = config.percentAboveThreshold !== undefined ? Number(config.percentAboveThreshold) : 12;
    const percentage = config.percentage !== undefined ? Number(config.percentage) : 12;
    const fixedFee = config.fixedFee !== undefined ? Number(config.fixedFee) : 50;
    const gstRate = config.gstPercent !== undefined ? Number(config.gstPercent) : 18;

    let platformFee = 0;

    if (mode === 'FIXED') {
        platformFee = fixedFee;
    } else if (mode === 'PERCENTAGE') {
        platformFee = (quote * percentage) / 100;
        if (minFee && platformFee < minFee) platformFee = minFee;
    } else {
        // Dynamic Tiered calculation
        if (quote <= threshold) {
            platformFee = minFee;
        } else {
            // Above threshold: fee = quote * percentAboveThreshold% (e.g. 550 * 12% = 66)
            platformFee = (quote * percentAboveThreshold) / 100;
            if (platformFee < minFee) platformFee = minFee;
        }
    }

    // Round platform fee to 2 decimal places
    platformFee = Math.round(platformFee * 100) / 100;

    // GST on Platform Fee (e.g. 66 * 18% = 11.88)
    const gstAmount = Math.round(((platformFee * gstRate) / 100) * 100) / 100;

    // Total Paid by Customer
    const customerTotal = Math.round((quote + platformFee + gstAmount) * 100) / 100;

    return {
        workerServiceAmount: quote,
        platformFee,
        gstAmount,
        gstRate,
        customerTotal,
        workerCommissionPercent: 0,
        workerNetEarning: quote // Worker gets 100% of quote!
    };
};

const calculateShopOrderFee = (netProductSales, deliveryCharge = 0, config = {}) => {
    const netSales = Math.max(0, Number(netProductSales) || 0);
    const delivery = Math.max(0, Number(deliveryCharge) || 0);
    const mode = config.mode || 'PERCENTAGE';
    const percentage = config.percentage !== undefined ? Number(config.percentage) : 5;
    const minFee = config.minFee !== undefined ? Number(config.minFee) : 10;
    const fixedFee = config.fixedFee !== undefined ? Number(config.fixedFee) : 10;
    const gstRate = config.gstPercent !== undefined ? Number(config.gstPercent) : 18;

    let platformFee = 0;

    if (mode === 'FIXED') {
        platformFee = fixedFee;
    } else {
        // Percentage fee on net product sales (e.g. 234 * 5% = 11.70)
        platformFee = (netSales * percentage) / 100;
        if (minFee && platformFee < minFee) platformFee = minFee;
    }

    platformFee = Math.round(platformFee * 100) / 100;

    // GST on Platform Fee (e.g. 11.70 * 18% = 2.11)
    const gstAmount = Math.round(((platformFee * gstRate) / 100) * 100) / 100;

    // Customer Total = Net Products + Platform Fee + GST + Delivery Fee
    const customerTotal = Math.round((netSales + platformFee + gstAmount + delivery) * 100) / 100;

    return {
        netProductSales: netSales,
        deliveryFee: delivery,
        platformFee,
        gstAmount,
        gstRate,
        customerTotal,
        shopCommissionPercent: 0,
        shopNetEarning: netSales // Shop gets 100% of product sales!
    };
};

module.exports = {
    calculateJobFee,
    calculateShopOrderFee
};
