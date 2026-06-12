const { StatusCodes } = require('http-status-codes');
const ShopOrder  = require('./shoporder.model');
const Shop       = require('../shop/shop.model');
const Customer   = require('../customer/customer.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');

/**
 * POST /api/v1/shoporders
 * Customer places a shop order
 */
exports.placeOrder = catchAsync(async (req, res) => {
    const { shopId, items, deliveryAddress, deliveryLocation, paymentMethod } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop || !shop.isOnline) return errorResponse(res, 'Shop is not available', StatusCodes.BAD_REQUEST);

    if (shop.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'Shop is not approved to receive orders.', StatusCodes.FORBIDDEN);
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const deliveryFee = subtotal >= shop.delivery.freeAbove ? 0 : shop.delivery.fee;
    const total = subtotal + deliveryFee;

    try {
        const customer = await Customer.findById(req.user._id);

        if (paymentMethod === 'WALLET') {
            if (!customer.wallet || customer.wallet.balance < total) {
                return errorResponse(res, 'Insufficient wallet balance', StatusCodes.BAD_REQUEST);
            }
            customer.wallet.balance -= total;
            await customer.save();
        }

        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

        const order = await ShopOrder.create({
            shopId,
            customerId: req.user._id,
            items,
            subtotal,
            deliveryFee,
            total,
            deliveryAddress,
            deliveryLocation,
            deliveryOtp,
            payment: { 
                amount: total, 
                status: paymentMethod === 'WALLET' ? 'PAID' : 'PENDING'
            }
        });

        if (paymentMethod === 'WALLET') {
            await WalletTxn.create({
                userId: customer._id,
                type: 'ORDER_PAYMENT',
                amount: total,
                balance: customer.wallet.balance,
                refId: String(order._id),
                description: `Paid for order #${String(order._id).slice(-6)}`
            });
        }

        // Notify shop owner
        emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: order._id, total });
        emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP_ORDER', id: order._id });

        return successResponse(res, order, 'Order placed successfully', StatusCodes.CREATED);
    } catch (error) {
        throw error;
    }
});

/**
 * GET /api/v1/shoporders/customer
 * Customer order history
 */
exports.getCustomerOrders = catchAsync(async (req, res) => {
    const orders = await ShopOrder.find({ customerId: req.user._id })
        .populate('shopId', 'name logoUrl')
        .sort('-createdAt');
    return successResponse(res, orders, 'Orders fetched');
});

/**
 * GET /api/v1/shoporders/shop
 * Shop dashboard order list
 */
exports.getShopOrders = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const { status } = req.query;
    const query = { shopId: shop._id };
    if (status && status !== 'all') query.status = status.toUpperCase();

    const orders = await ShopOrder.find(query)
        .populate('customerId', 'name phone')
        .sort('-createdAt');
    return successResponse(res, orders, 'Shop orders fetched');
});

/**
 * GET /api/v1/shoporders/:id
 */
exports.getOrderById = catchAsync(async (req, res) => {
    const order = await ShopOrder.findById(req.params.id)
        .populate('shopId', 'name logoUrl address')
        .populate('customerId', 'name phone');
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
    return successResponse(res, order, 'Order fetched');
});

/**
 * GET /api/v1/shoporders/:id/invoice
 * Returns a printable HTML invoice
 */
exports.downloadInvoice = catchAsync(async (req, res) => {
    const order = await ShopOrder.findById(req.params.id)
        .populate('shopId', 'name address phone')
        .populate('customerId', 'name phone email');
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice #${order._id.toString().slice(-6).toUpperCase()}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #0e9aa7; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { color: #0e9aa7; margin: 0; font-size: 28px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .table th { background-color: #f8f9fa; }
            .total { text-align: right; font-size: 1.2em; font-weight: bold; }
            @media print {
                body { padding: 0; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Kwickly Invoice</h1>
            <p>Order #${order._id.toString().slice(-6).toUpperCase()}</p>
        </div>
        <div class="details">
            <div>
                <strong>From:</strong><br>
                ${order.shopId?.name || 'Shop'}<br>
                ${order.shopId?.address || ''}<br>
                ${order.shopId?.phone || ''}
            </div>
            <div style="text-align: right;">
                <strong>To:</strong><br>
                ${order.customerId?.name || 'Customer'}<br>
                ${order.deliveryAddress || ''}<br>
                ${order.customerId?.phone || ''}
            </div>
        </div>
        <table class="table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${order.items.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.qty}</td>
                    <td>₹${item.price}</td>
                    <td>₹${item.price * item.qty}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        <div style="text-align: right; margin-bottom: 10px;">
            Subtotal: ₹${order.subtotal}
        </div>
        <div style="text-align: right; margin-bottom: 20px;">
            Delivery Fee: ₹${order.deliveryFee}
        </div>
        <div class="total">
            Grand Total: ₹${order.total}
        </div>
        <div style="margin-top: 50px; text-align: center; color: #888; font-size: 0.9em;">
            Thank you for shopping with Kwickly!
            <br><br>
            <button class="no-print" onclick="window.print()" style="padding: 10px 20px; background: #0e9aa7; color: white; border: none; border-radius: 8px; cursor: pointer;">Print / Save as PDF</button>
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

/**
 * PATCH /api/v1/shoporders/:id/status
 * Shop owner advances the order status
 */
exports.updateOrderStatus = catchAsync(async (req, res) => {
    const { status, otp } = req.body;
    const validStatuses = ['PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status', StatusCodes.BAD_REQUEST);

    const order = await ShopOrder.findById(req.params.id);
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);

    order.status = status;

    // On delivery, check OTP and credit shop wallet
    if (status === 'DELIVERED') {
        if (!otp || String(otp) !== String(order.deliveryOtp)) {
            return errorResponse(res, 'Invalid delivery OTP', StatusCodes.BAD_REQUEST);
        }
        
        try {
            // Reduce Stock for each item
            if (order.items && order.items.length > 0) {
                const Product = require('../product/product.model');
                for (const item of order.items) {
                    if (item.productId) {
                        await Product.findByIdAndUpdate(item.productId, {
                            $inc: { stock: -item.qty }
                        });
                    }
                }
            }

            order.payment.status = 'PAID';
            const settings = require('../settings/settings.model');
            const cfg = await settings.findOne();
            const commissionPercent = cfg?.fees?.percentage ?? 10;
            const commission = Math.round(order.total * commissionPercent / 100);
            const shopPayout = order.total - commission;

            const updatedShop = await Shop.findByIdAndUpdate(
                order.shopId,
                { $inc: { 'wallet.balance': shopPayout, totalOrders: 1 } },
                { new: true }
            );

            await WalletTxn.create({
                userId:      updatedShop.ownerId,
                type:        'ORDER_CREDIT',
                amount:      shopPayout,
                balance:     updatedShop.wallet.balance,
                refId:       String(order._id),
                description: `Order #${String(order._id).slice(-6)} payout`
            });

            await order.save();
        } catch (error) {
            throw error;
        }
    } else {
        await order.save();
    }

    // Notify customer
    emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', { orderId: order._id, status });

    return successResponse(res, order, 'Order status updated');
});

/**
 * GET /api/v1/shoporders (Admin)
 */
exports.getAllOrders = catchAsync(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();

    const total = await ShopOrder.countDocuments(query);
    const orders = await ShopOrder.find(query)
        .populate('shopId', 'name')
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    return successResponse(res, { orders, total, page, totalPages: Math.ceil(total / limit) }, 'All orders fetched');
});
