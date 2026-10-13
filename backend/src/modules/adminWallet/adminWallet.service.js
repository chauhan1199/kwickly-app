const { AdminWallet, AdminWalletTxn } = require('./adminWallet.model');

async function getOrCreateWallet(options = {}) {
    const { session } = options;
    const queryOptions = session ? { session } : {};

    let wallet = await AdminWallet.findOne({}, null, queryOptions);
    if (!wallet) {
        const [createdWallet] = await AdminWallet.create([{ balance: 0 }], queryOptions);
        wallet = createdWallet;
    }
    return wallet;
}

async function adjustWalletBalance({
    amount,
    increment,
    txnType,
    description,
    referenceId,
    referenceModel,
    meta = {},
    session,
    requireSufficientBalance = false,
}) {
    const numericAmount = Number(amount);
    const query = requireSufficientBalance
        ? { balance: { $gte: numericAmount } }
        : {};
    const update = { $inc: { balance: increment * numericAmount } };
    const options = { returnDocument: 'after', upsert: !requireSufficientBalance };
    if (session) options.session = session;

    const wallet = await AdminWallet.findOneAndUpdate(query, update, options);
    if (!wallet) {
        throw new Error('Insufficient admin wallet balance for payout');
    }

    const txnPayload = {
        type: txnType,
        amount: numericAmount,
        balanceAfter: wallet.balance,
        description,
        referenceId,
        referenceModel,
        meta,
    };

    if (session) {
        const [txn] = await AdminWalletTxn.create([txnPayload], { session });
        return txn;
    }

    return AdminWalletTxn.create(txnPayload);
}

async function collectCommission(amount, description, referenceId, referenceModel, meta = {}, options = {}) {
    return adjustWalletBalance({
        amount,
        increment: 1,
        txnType: 'COMMISSION_COLLECTED',
        description,
        referenceId,
        referenceModel,
        meta,
        session: options.session,
    });
}

async function collectPlatformFee(amount, description, referenceId, referenceModel, meta = {}, options = {}) {
    return adjustWalletBalance({
        amount,
        increment: 1,
        txnType: 'PLATFORM_FEE_COLLECTED',
        description,
        referenceId,
        referenceModel,
        meta,
        session: options.session,
    });
}

// A promo discount the platform absorbs (the partner is still paid in full).
async function recordPromoCost(amount, description, referenceId, referenceModel, meta = {}, options = {}) {
    return adjustWalletBalance({
        amount,
        increment: -1,
        txnType: 'FEE_REVERSAL',
        description,
        referenceId,
        referenceModel,
        meta: { ...meta, reason: 'PROMO_DISCOUNT' },
        session: options.session,
    });
}

async function debitForPayout(amount, description, referenceId, referenceModel, meta = {}, options = {}) {
    return adjustWalletBalance({
        amount,
        increment: -1,
        txnType: 'PAYOUT_DEBIT',
        description,
        referenceId,
        referenceModel,
        meta,
        session: options.session,
        requireSufficientBalance: true,
    });
}

module.exports = {
    getOrCreateWallet,
    collectCommission,
    collectPlatformFee,
    recordPromoCost,
    debitForPayout,
};
