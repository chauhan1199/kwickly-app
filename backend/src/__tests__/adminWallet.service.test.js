jest.mock('../modules/adminWallet/adminWallet.model', () => ({
    AdminWallet: {
        findOne: jest.fn(),
        create: jest.fn(),
        findOneAndUpdate: jest.fn(),
    },
    AdminWalletTxn: {
        create: jest.fn(),
    },
}));

const { AdminWallet, AdminWalletTxn } = require('../modules/adminWallet/adminWallet.model');
const {
    getOrCreateWallet,
    collectCommission,
    collectPlatformFee,
    debitForPayout,
} = require('../modules/adminWallet/adminWallet.service');

describe('adminWallet.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates the singleton wallet on first access', async () => {
        AdminWallet.findOne.mockResolvedValueOnce(null);
        AdminWallet.create.mockResolvedValueOnce([{ _id: 'wallet-1', balance: 0 }]);

        const wallet = await getOrCreateWallet();

        expect(AdminWallet.findOne).toHaveBeenCalledWith({}, null, {});
        expect(AdminWallet.create).toHaveBeenCalledWith([{ balance: 0 }], {});
        expect(wallet).toEqual({ _id: 'wallet-1', balance: 0 });
    });

    it('collects platform fees inside a provided session', async () => {
        const session = { id: 'session-1' };
        AdminWallet.findOneAndUpdate.mockResolvedValueOnce({ balance: 450 });
        AdminWalletTxn.create.mockResolvedValueOnce([{ _id: 'txn-1' }]);

        const txn = await collectPlatformFee(
            50,
            'Platform fee from job',
            'job-1',
            'Job',
            { workerId: 'worker-1' },
            { session }
        );

        expect(AdminWallet.findOneAndUpdate).toHaveBeenCalledWith(
            {},
            { $inc: { balance: 50 } },
            { returnDocument: 'after', upsert: true, session }
        );
        expect(AdminWalletTxn.create).toHaveBeenCalledWith([
            {
                type: 'PLATFORM_FEE_COLLECTED',
                amount: 50,
                balanceAfter: 450,
                description: 'Platform fee from job',
                referenceId: 'job-1',
                referenceModel: 'Job',
                meta: { workerId: 'worker-1' },
            },
        ], { session });
        expect(txn).toEqual({ _id: 'txn-1' });
    });

    it('collects commission without a session using a single document create', async () => {
        AdminWallet.findOneAndUpdate.mockResolvedValueOnce({ balance: 225 });
        AdminWalletTxn.create.mockResolvedValueOnce({ _id: 'txn-2' });

        const txn = await collectCommission(25, 'Settlement commission', 'settlement-1', 'Settlement');

        expect(AdminWallet.findOneAndUpdate).toHaveBeenCalledWith(
            {},
            { $inc: { balance: 25 } },
            { returnDocument: 'after', upsert: true }
        );
        expect(AdminWalletTxn.create).toHaveBeenCalledWith({
            type: 'COMMISSION_COLLECTED',
            amount: 25,
            balanceAfter: 225,
            description: 'Settlement commission',
            referenceId: 'settlement-1',
            referenceModel: 'Settlement',
            meta: {},
        });
        expect(txn).toEqual({ _id: 'txn-2' });
    });

    it('throws when debiting payout with insufficient balance', async () => {
        AdminWallet.findOneAndUpdate.mockResolvedValueOnce(null);

        await expect(
            debitForPayout(99, 'Payout transfer', 'payout-1', 'Payout')
        ).rejects.toThrow('Insufficient admin wallet balance for payout');

        expect(AdminWalletTxn.create).not.toHaveBeenCalled();
    });
});
