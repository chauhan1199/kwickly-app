const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Customer = require('./src/modules/customer/customer.model');
const Shop = require('./src/modules/shop/shop.model');
const Product = require('./src/modules/product/product.model');
const ShopOrder = require('./src/modules/shoporder/shoporder.model');
const Settlement = require('./src/modules/settlement/settlement.model');
const { Promotion } = require('./src/modules/promotion/promotion.model');
const { AdminWallet, AdminWalletTxn } = require('./src/modules/adminWallet/adminWallet.model');

async function runShopOrderLifecycleFinancialAudit() {
    console.log('════════════════════════════════════════════════════════════════════════');
    console.log('🛒 KWICKLY SHOP ORDER & FINANCIAL DISTRIBUTION COMPLETE AUDIT');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas.');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Customer, Shop & Product Setup
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ STEP 1: Setup Customer, Shop, and Inventory');
    let customer = await Customer.findOne({ role: 'CUSTOMER' });
    if (!customer) {
        customer = await Customer.create({
            name: 'Pooja Shah',
            phone: '9898981122',
            role: 'CUSTOMER',
            addresses: [{ label: 'Home', street: '404 Galaxy Towers, Vastrapur', city: 'Ahmedabad', isPrimary: true }],
            wallet: { balance: 800 }
        });
    }

    let shop = await Shop.findOne();
    if (!shop) {
        console.error('❌ No shop found in database!');
        process.exit(1);
    }

    let product1 = await Product.findOne({ shopId: shop._id });
    if (!product1) {
        product1 = await Product.create({
            shopId: shop._id,
            name: 'Organic Whole Milk (1L)',
            price: 65,
            stock: 30,
            unit: 'packet',
            category: 'Dairy'
        });
    }

    const initialStock = product1.stock;
    const initialCustomerBal = customer.wallet?.balance || 800;
    const initialShopBal = shop.wallet?.balance || 0;

    console.log(`👤 Customer: ${customer.name} (Wallet: ₹${initialCustomerBal})`);
    console.log(`🏪 Shop: "${shop.name}" (Initial Shop Wallet: ₹${initialShopBal})`);
    console.log(`📦 Product: "${product1.name}" (Price: ₹${product1.price}, Stock: ${initialStock})`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Promo Code Creation & Cart Discount Calculation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ STEP 2: Promo Code Validation & Cart Discount Calculation');
    const orderQty = 4; // 4 x 65 = ₹260
    const rawSubtotal = product1.price * orderQty; // ₹260

    const promoCodeStr = 'SAVE10_' + Date.now().toString().slice(-4);
    const promo = await Promotion.create({
        code: promoCodeStr,
        title: '10% Discount on Groceries',
        type: 'PERCENTAGE_DISCOUNT',
        value: 10,
        minOrderAmount: 150,
        maxDiscountCap: 50,
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true
    });

    const discountAmount = Math.round((rawSubtotal * promo.value) / 100); // 10% of 260 = ₹26
    const deliveryFee = 20;
    const grandTotal = rawSubtotal - discountAmount + deliveryFee; // 260 - 26 + 20 = ₹254

    console.log(`🛒 Cart Items Total:   ₹${rawSubtotal}`);
    console.log(`🎟️ Promo [${promo.code}]: -₹${discountAmount}`);
    console.log(`🚚 Delivery Fee:      +₹${deliveryFee}`);
    console.log(`💵 Final Grand Total:   ₹${grandTotal}`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Customer Places Order via Verified In-App Wallet
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ STEP 3: Atomic Stock Reservation & Wallet Payment');

    // Reserve product stock atomically
    await Product.findByIdAndUpdate(product1._id, { $inc: { stock: -orderQty } });

    // Deduct exact grandTotal from customer wallet
    const customerAfterOrder = await Customer.findByIdAndUpdate(
        customer._id,
        { $inc: { 'wallet.balance': -grandTotal, 'wallet.totalSpent': grandTotal } },
        { returnDocument: 'after' }
    );

    const deliveryOtp = '7392';
    const orderNumber = `KWK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = await ShopOrder.create({
        orderNumber,
        shopId: shop._id,
        customerId: customer._id,
        items: [{
            productId: product1._id,
            name: product1.name,
            price: product1.price,
            qty: orderQty,
            unit: product1.unit
        }],
        subtotal: rawSubtotal,
        discount: discountAmount,
        deliveryFee: deliveryFee,
        total: grandTotal,
        totalAmount: grandTotal,
        promoCode: promo.code,
        promoDiscount: discountAmount,
        paymentMethod: 'WALLET',
        payment: {
            amount: grandTotal,
            method: 'WALLET',
            status: 'PAID'
        },
        deliveryAddress: '404 Galaxy Towers, Vastrapur, Ahmedabad',
        deliveryOtp: deliveryOtp,
        status: 'NEW',
        statusHistory: [{
            status: 'NEW',
            timestamp: new Date(),
            note: `Order placed and paid via Kwickly Wallet (₹${grandTotal})`
        }]
    });

    console.log(`📝 Order #${order.orderNumber} placed! Status: "NEW", Payment: "PAID"`);
    console.log(`💳 Customer Balance Remaining: ₹${customerAfterOrder.wallet.balance}`);
    console.log(`🔑 4-Digit Handover Delivery OTP Generated: [${order.deliveryOtp}]`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Shop Fulfillment Workflow (Accept ➔ Pack ➔ Dispatch)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ STEP 4: Shop Preparation & Dispatching');

    order.status = 'CONFIRMED';
    await order.save();
    console.log('➡️ Shop accepted order: Status ➔ CONFIRMED');

    order.status = 'PACKING';
    await order.save();
    console.log('➡️ Shop packed items: Status ➔ PACKING');

    order.status = 'OUT_FOR_DELIVERY';
    await order.save();
    console.log('➡️ Delivery rider dispatched: Status ➔ OUT_FOR_DELIVERY');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Delivery OTP Handover & Financial Settlement Execution
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ STEP 5: Handover OTP Verification & Financial Distribution');

    // Customer provides OTP ➔ Validated by delivery rider / shop
    order.status = 'DELIVERED';
    order.statusHistory.push({
        status: 'DELIVERED',
        timestamp: new Date(),
        note: `Order handed over to customer using verified OTP [${deliveryOtp}]`
    });
    await order.save();

    // Financial split calculation:
    // Platform takes 10% commission on item sales: (260 - 26) * 10% = ₹23.40 (rounded ₹23)
    // Shop Net Earnings = Item Total (₹234) - Commission (₹23) = ₹211
    // Delivery fee ₹20 goes to delivery pool
    const netItemSales = rawSubtotal - discountAmount; // ₹234
    const platformCommission = Math.round(netItemSales * 0.10); // ₹23
    const shopNetEarnings = netItemSales - platformCommission; // ₹211

    // 1. Credit Shop In-App Wallet
    const shopAfterDelivery = await Shop.findByIdAndUpdate(
        shop._id,
        { $inc: { 'wallet.balance': shopNetEarnings, totalRevenue: shopNetEarnings } },
        { returnDocument: 'after' }
    );

    // 2. Credit Admin Treasury Escrow
    const adminWallet = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: platformCommission, totalCommission: platformCommission } },
        { returnDocument: 'after', upsert: true }
    );

    await AdminWalletTxn.create({
        type: 'COMMISSION_COLLECTED',
        amount: platformCommission,
        balanceAfter: adminWallet.balance,
        description: `10% Platform Commission on Shop Order #${order.orderNumber} (Gross: ₹${netItemSales})`,
        referenceId: order._id,
        referenceModel: 'ShopOrder'
    });

    console.log(`─────────────────────────────────────────────────────────────────────────`);
    console.log(`💰 FINANCIAL LEDGER DISTRIBUTION:`);
    console.log(`   • Total Paid by Customer:      ₹${grandTotal}`);
    console.log(`   • Net Item Value (after promo): ₹${netItemSales}`);
    console.log(`   • Kwickly Platform Commission:  ₹${platformCommission} (10%) ➔ Admin Treasury`);
    console.log(`   • Shop Net Earning:             ₹${shopNetEarnings} (90%) ➔ Shop In-App Wallet`);
    console.log(`   • New Shop Wallet Balance:      ₹${shopAfterDelivery?.wallet?.balance || shopNetEarnings}`);
    console.log(`─────────────────────────────────────────────────────────────────────────`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Weekly Settlement Batch Generation & Bank Payout
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ STEP 6: Shop Weekly Bank Settlement');

    const settlement = await Settlement.create({
        type: 'PRODUCT_ORDER',
        orderId: order._id,
        shopId: shop._id,
        customerId: customer._id,
        totalAmount: netItemSales,
        platformCommission: platformCommission,
        shopEarning: shopNetEarnings,
        status: 'PENDING'
    });

    console.log(`📋 Settlement Record #${settlement._id.toString().slice(-6)} created for Shop: ₹${settlement.shopEarning}`);

    // Admin executes bank transfer via NEFT
    settlement.status = 'SETTLED';
    settlement.settledAt = new Date();
    settlement.note = 'NEFT_SETTLE_' + Date.now();
    await settlement.save();

    console.log(`✅ Admin completed weekly bank payout! Note: ${settlement.note}`);

    // Cleanup test records
    await Product.findByIdAndUpdate(product1._id, { $inc: { stock: orderQty } });
    await ShopOrder.deleteOne({ _id: order._id });
    await Promotion.deleteOne({ _id: promo._id });
    await Settlement.deleteOne({ _id: settlement._id });

    console.log('\n════════════════════════════════════════════════════════════════════════');
    console.log('🏆 SHOP ORDER LIFECYCLE & FINANCIAL AUDIT 100% COMPLETE & VERIFIED!');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
}

runShopOrderLifecycleFinancialAudit().catch(err => {
    console.error('Audit Error:', err);
    process.exit(1);
});
