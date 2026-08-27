const { StatusCodes } = require('http-status-codes');
const PlatformLedger = require('./platformLedger.model');
const { AdminWallet } = require('../adminWallet/adminWallet.model');
const Customer = require('../customer/customer.model');
const Shop = require('../shop/shop.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

/**
 * GET /api/v1/ledger
 * Paginated query for all financial ledger transactions
 */
exports.getLedgerEntries = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, entityType, settlementStatus, search, startDate, endDate } = req.query;
    const query = {};

    if (entityType && entityType !== 'ALL') {
        query.entityType = entityType;
    }
    if (settlementStatus && settlementStatus !== 'ALL') {
        query.settlementStatus = settlementStatus;
    }
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search && search.trim()) {
        const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
            { transactionId: regex },
            { settlementId: regex },
            { referenceNumber: regex },
            { utrNumber: regex },
            { description: regex }
        ];
    }

    const total = await PlatformLedger.countDocuments(query);
    const entries = await PlatformLedger.find(query)
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, {
        entries,
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1,
        currentPage: Number(page)
    }, 'Platform ledger entries fetched');
});

/**
 * GET /api/v1/ledger/reconciliation
 * Calculates daily and aggregate reconciliation invariant
 */
exports.getReconciliation = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const match = { settlementStatus: 'SETTLED' };

    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const aggregation = await PlatformLedger.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalCustomerInflows: { $sum: '$grossAmount' },
                totalWorkerEarnings: {
                    $sum: { $cond: [{ $eq: ['$entityType', 'SERVICE_JOB'] }, '$partnerAmount', 0] }
                },
                totalShopEarnings: {
                    $sum: { $cond: [{ $eq: ['$entityType', 'SHOP_ORDER'] }, '$partnerAmount', 0] }
                },
                totalPlatformFees: { $sum: '$platformFee' },
                totalGstLiability: { $sum: '$gstAmount' },
                totalDeliveryFees: { $sum: '$deliveryFee' },
                totalRefunds: { $sum: '$refundAmount' }
            }
        }
    ]);

    const stats = aggregation[0] || {
        totalCustomerInflows: 0,
        totalWorkerEarnings: 0,
        totalShopEarnings: 0,
        totalPlatformFees: 0,
        totalGstLiability: 0,
        totalDeliveryFees: 0,
        totalRefunds: 0
    };

    const calculatedOutflows = (
        stats.totalWorkerEarnings +
        stats.totalShopEarnings +
        stats.totalPlatformFees +
        stats.totalGstLiability +
        stats.totalDeliveryFees +
        stats.totalRefunds
    );

    const discrepancy = Math.abs(Math.round((stats.totalCustomerInflows - calculatedOutflows) * 100) / 100);
    const isReconciled = discrepancy <= 0.05; // allow sub-cent floating point precision

    return successResponse(res, {
        summary: stats,
        calculatedOutflows,
        discrepancy,
        isReconciled,
        status: isReconciled ? 'BALANCED' : 'DISCREPANCY_DETECTED',
        reconciliationFormula: 'Customer Inflows == Worker + Shop + Platform Fee + GST + Delivery + Refunds'
    }, 'Reconciliation report generated');
});

/**
 * GET /api/v1/ledger/treasury-summary
 * Provides segregated balances for Kwickly Treasury, GST, and Partner liabilities
 */
exports.getTreasurySummary = catchAsync(async (req, res) => {
    const adminWallet = await AdminWallet.findOne().lean();

    // Calculate Partner Wallet Liabilities directly from database
    const workerLiabilityAgg = await Customer.aggregate([
        { $match: { role: 'WORKER', 'wallet.balance': { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$wallet.balance' } } }
    ]);
    const shopLiabilityAgg = await Shop.aggregate([
        { $match: { 'wallet.balance': { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$wallet.balance' } } }
    ]);
    const customerLiabilityAgg = await Customer.aggregate([
        { $match: { role: 'CUSTOMER', 'wallet.balance': { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$wallet.balance' } } }
    ]);

    const workerWalletLiability = workerLiabilityAgg[0]?.total || 0;
    const shopWalletLiability = shopLiabilityAgg[0]?.total || 0;
    const customerWalletLiability = customerLiabilityAgg[0]?.total || 0;

    // Calculate Subscription SaaS Revenue vs Marketplace Fee Revenue from Ledger
    const revenueAgg = await PlatformLedger.aggregate([
        { $match: { settlementStatus: { $in: ['SETTLED', 'PAID'] } } },
        {
            $group: {
                _id: null,
                workerSubRevenue: {
                    $sum: { $cond: [{ $eq: ['$entityType', 'WORKER_SUBSCRIPTION'] }, '$grossAmount', 0] }
                },
                shopSubRevenue: {
                    $sum: { $cond: [{ $eq: ['$entityType', 'SHOP_SUBSCRIPTION'] }, '$grossAmount', 0] }
                },
                jobFeeRevenue: {
                    $sum: { $cond: [{ $eq: ['$entityType', 'SERVICE_JOB'] }, '$platformFee', 0] }
                },
                shopFeeRevenue: {
                    $sum: { $cond: [{ $eq: ['$entityType', 'SHOP_ORDER'] }, '$platformFee', 0] }
                },
                totalGstLiability: { $sum: '$gstAmount' }
            }
        }
    ]);

    const rev = revenueAgg[0] || {
        workerSubRevenue: 0,
        shopSubRevenue: 0,
        jobFeeRevenue: 0,
        shopFeeRevenue: 0,
        totalGstLiability: 0
    };

    const saasSubscriptionRevenue = rev.workerSubRevenue + rev.shopSubRevenue;
    const marketplaceFeeRevenue = rev.jobFeeRevenue + rev.shopFeeRevenue;
    const totalPlatformRevenue = saasSubscriptionRevenue + marketplaceFeeRevenue;

    return successResponse(res, {
        treasury: {
            totalPlatformRevenue,
            saasSubscriptionRevenue,
            marketplaceFeeRevenue,
            workerSubscriptionRevenue: rev.workerSubRevenue,
            shopSubscriptionRevenue: rev.shopSubRevenue,
            serviceJobPlatformFeeRevenue: rev.jobFeeRevenue,
            shopOrderPlatformFeeRevenue: rev.shopFeeRevenue,
            adminWalletBalance: adminWallet?.balance || 0
        },
        taxLiability: {
            gstLiability: rev.totalGstLiability,
            gstNote: 'Tracked separately from Kwickly Treasury revenue'
        },
        partnerLiabilities: {
            workerWalletLiability,
            shopWalletLiability,
            customerWalletLiability,
            totalPartnerLiability: workerWalletLiability + shopWalletLiability + customerWalletLiability
        }
    }, 'Treasury & Liability summary generated');
});

/**
 * GET /api/v1/ledger/gst-report
 */
exports.getGstReport = catchAsync(async (req, res) => {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? Number(month) - 1 : now.getMonth();
    const targetYear = year ? Number(year) : now.getFullYear();

    const start = new Date(targetYear, targetMonth, 1);
    const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const gstRecords = await PlatformLedger.find({
        createdAt: { $gte: start, $lte: end },
        gstAmount: { $gt: 0 },
        settlementStatus: { $in: ['SETTLED', 'PAID'] }
    }).select('transactionId referenceNumber entityType grossAmount platformFee gstAmount createdAt paymentMethod').lean();

    const totalGst = gstRecords.reduce((sum, r) => sum + (r.gstAmount || 0), 0);
    const totalTaxableValue = gstRecords.reduce((sum, r) => sum + (r.platformFee || 0), 0);

    return successResponse(res, {
        period: { month: targetMonth + 1, year: targetYear },
        totalTaxableValue,
        totalGst,
        recordCount: gstRecords.length,
        records: gstRecords
    }, 'Monthly GST report generated');
});
