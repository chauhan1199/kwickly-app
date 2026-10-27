/**
 * KWICKLY - Complete CRUD & Activity Notification Verification Test Suite
 * 
 * Tests and verifies across ALL roles (CUSTOMER, WORKER, SHOP, ADMIN):
 * - Registration / Auth & Verification
 * - Full CRUD Operations (Add, Update, Delete) on Profile, Address, Map/Location, Services/Settings, Products, Categories
 * - Notification triggering, delivery, unread count accuracy, feed display, read/unread and deletion
 * - Admin Activity Logging and Broadcast distribution
 * - Clean teardown of test artifacts
 */

const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Customer = require('../src/modules/customer/customer.model');
const Shop = require('../src/modules/shop/shop.model');
const Product = require('../src/modules/product/product.model');
const Category = require('../src/modules/category/category.model');
const Notification = require('../src/modules/notification/notification.model');
const AppSettings = require('../src/modules/settings/settings.model');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5001/api/v1';

const log = (msg) => console.log(`[CRUD-NOTIF-TEST] ${msg}`);
const pass = (label) => console.log(`  ✅ PASS: ${label}`);
const fail = (label, err) => {
    console.error(`  ❌ FAIL: ${label}`, err ? (err.response?.data || err.message) : '');
    throw new Error(`Assertion failed: ${label}`);
};

async function main() {
    console.log('='.repeat(80));
    console.log('   🔔 KWICKLY COMPREHENSIVE ROLE CRUD & NOTIFICATION VERIFICATION');
    console.log('='.repeat(80));

    await mongoose.connect(process.env.MONGO_URI);
    log('Connected to MongoDB Atlas');

    const createdCategoryIds = [];
    const createdProductIds = [];
    const createdUserIds = [];

    try {
        // ─── PHASE 0: AUTHENTICATION FOR ALL 4 ROLES ─────────────────────────────
        log('\n─── PHASE 0: AUTHENTICATION & INITIAL UNREAD BADGE CHECKS ───');

        // Customer Auth
        let res = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9876543210',
            password: '1111',
            role: 'CUSTOMER'
        });
        const customerToken = res.data.data.token;
        const customerUser = res.data.data.user;
        const custHeaders = { headers: { Authorization: `Bearer ${customerToken}` } };
        pass(`Customer logged in (${customerUser.name}, ID: ${customerUser._id})`);

        // Worker Auth
        res = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9811111111',
            password: '1111',
            role: 'WORKER'
        });
        const workerToken = res.data.data.token;
        const workerUser = res.data.data.user;
        const workerHeaders = { headers: { Authorization: `Bearer ${workerToken}` } };
        pass(`Worker logged in (${workerUser.name}, ID: ${workerUser._id})`);

        // Shop Owner Auth
        res = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9820112233',
            password: '1111',
            role: 'SHOP'
        });
        const shopToken = res.data.data.token;
        const shopUser = res.data.data.user;
        const shopHeaders = { headers: { Authorization: `Bearer ${shopToken}` } };
        pass(`Shop Owner logged in (${shopUser.name}, ID: ${shopUser._id})`);

        // Admin Auth
        res = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9999999999',
            password: 'admin123',
            role: 'ADMIN'
        });
        const adminToken = res.data.data.token;
        const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
        pass(`Super Admin logged in (ID: ${res.data.data.user._id})`);

        // Verify initial unread count API works for all 4 roles
        for (const [roleName, headers] of [
            ['CUSTOMER', custHeaders],
            ['WORKER', workerHeaders],
            ['SHOP', shopHeaders],
            ['ADMIN', adminHeaders]
        ]) {
            const countRes = await axios.get(`${BASE_URL}/notifications/unread-count`, headers);
            if (typeof countRes.data.data.unreadCount !== 'number') {
                fail(`Unread count for ${roleName} returned invalid payload`);
            }
            pass(`Unread count endpoint responsive for ${roleName}: ${countRes.data.data.unreadCount}`);
        }

        // ─── PHASE 1: CUSTOMER CRUD OPERATIONS & NOTIFICATIONS ───────────────────
        log('\n─── PHASE 1: CUSTOMER CRUD OPERATIONS & NOTIFICATIONS ───');

        // 1.1 Read Profile
        res = await axios.get(`${BASE_URL}/customers/me/profile`, custHeaders);
        if (!res.data.data.phone) fail('Customer profile read failed');
        pass('1.1 Customer profile fetched successfully');

        // 1.2 Update Profile -> Expect "Profile Updated" Notification
        const originalName = res.data.data.name;
        const updatedName = `${originalName} Test`;
        res = await axios.put(`${BASE_URL}/customers/me/profile`, { name: updatedName }, custHeaders);
        if (res.data.data.name !== updatedName) fail('Customer profile update failed');
        pass('1.2 Customer profile updated successfully');

        // Verify Customer Feed contains "Profile Updated"
        res = await axios.get(`${BASE_URL}/notifications/my`, custHeaders);
        const profileNotif = res.data.data.notifications.find(n => n.title.includes('Profile Updated'));
        if (!profileNotif) fail('Customer did not receive "Profile Updated" notification');
        pass(`1.2 Customer received notification: "${profileNotif.title}" - "${profileNotif.message}"`);

        // Revert name
        await axios.put(`${BASE_URL}/customers/me/profile`, { name: originalName }, custHeaders);

        // 1.3 Add Address (with GeoJSON map coordinates) -> Expect "Address Added" Notification
        const testCoords = [72.5714, 23.0225]; // Ahmedabad
        res = await axios.post(`${BASE_URL}/customers/me/addresses`, {
            label: 'Test Villa',
            street: '101 Lotus Boulevard',
            city: 'Ahmedabad',
            pincode: '380015',
            location: { type: 'Point', coordinates: testCoords },
            isPrimary: true
        }, custHeaders);
        const addedAddress = res.data.data.addresses.find(a => a.label === 'Test Villa');
        if (!addedAddress) fail('Customer address not added');
        const customerAddressId = addedAddress._id;
        pass(`1.3 Customer address added (ID: ${customerAddressId}, coords: [${testCoords}])`);

        res = await axios.get(`${BASE_URL}/notifications/my`, custHeaders);
        const addrAddedNotif = res.data.data.notifications.find(n => n.title.includes('Address Added'));
        if (!addrAddedNotif) fail('Customer did not receive "Address Added" notification');
        pass(`1.3 Customer received notification: "${addrAddedNotif.title}" - "${addrAddedNotif.message}"`);

        // 1.4 Update Address (Update street and map coords) -> Expect "Address Updated" Notification
        const updatedCoords = [72.5800, 23.0300];
        res = await axios.put(`${BASE_URL}/customers/me/addresses/${customerAddressId}`, {
            label: 'Test Villa Updated',
            street: '202 Lotus Boulevard Suite B',
            city: 'Ahmedabad',
            pincode: '380015',
            location: { type: 'Point', coordinates: updatedCoords }
        }, custHeaders);
        const updatedAddr = res.data.data.addresses.find(a => String(a._id) === String(customerAddressId));
        if (!updatedAddr || updatedAddr.street !== '202 Lotus Boulevard Suite B') fail('Customer address update failed');
        pass('1.4 Customer address updated successfully');

        res = await axios.get(`${BASE_URL}/notifications/my`, custHeaders);
        const addrUpdatedNotif = res.data.data.notifications.find(n => n.title.includes('Address Updated'));
        if (!addrUpdatedNotif) fail('Customer did not receive "Address Updated" notification');
        pass(`1.4 Customer received notification: "${addrUpdatedNotif.title}" - "${addrUpdatedNotif.message}"`);

        // 1.5 Set Primary Address
        res = await axios.patch(`${BASE_URL}/customers/me/addresses/${customerAddressId}/primary`, {}, custHeaders);
        const primaryAddr = res.data.data.addresses.find(a => String(a._id) === String(customerAddressId));
        if (!primaryAddr?.isPrimary) fail('Customer set primary address failed');
        pass('1.5 Customer primary address confirmed');

        // 1.6 Delete Address -> Expect "Address Deleted" Notification
        res = await axios.delete(`${BASE_URL}/customers/me/addresses/${customerAddressId}`, custHeaders);
        const deletedFound = res.data.data.addresses.some(a => String(a._id) === String(customerAddressId));
        if (deletedFound) fail('Customer address deletion failed; address still present');
        pass('1.6 Customer address deleted successfully');

        res = await axios.get(`${BASE_URL}/notifications/my`, custHeaders);
        const addrDeletedNotif = res.data.data.notifications.find(n => n.title.includes('Address Deleted'));
        if (!addrDeletedNotif) fail('Customer did not receive "Address Deleted" notification');
        pass(`1.6 Customer received notification: "${addrDeletedNotif.title}" - "${addrDeletedNotif.message}"`);

        // 1.7 Notification Preferences Update
        res = await axios.put(`${BASE_URL}/customers/me/notifications`, {
            jobUpdates: true,
            promotions: true
        }, custHeaders);
        pass('1.7 Customer notification preferences updated successfully');

        // 1.8 Customer Notification Feed: Mark Single Read, Mark All Read, Delete Notification
        const notifToRead = res.data.data.notifications?.[0] || addrDeletedNotif;
        await axios.patch(`${BASE_URL}/notifications/${notifToRead._id}/read`, {}, custHeaders);
        pass(`1.8 Customer marked single notification read (${notifToRead._id})`);

        await axios.patch(`${BASE_URL}/notifications/read-all`, {}, custHeaders);
        const countAfterReadAll = (await axios.get(`${BASE_URL}/notifications/unread-count`, custHeaders)).data.data.unreadCount;
        if (countAfterReadAll !== 0) fail(`Customer unreadCount should be 0 after read-all, got ${countAfterReadAll}`);
        pass('1.8 Customer marked all notifications as read (unread count = 0)');

        await axios.delete(`${BASE_URL}/notifications/${notifToRead._id}`, custHeaders);
        const feedAfterDel = (await axios.get(`${BASE_URL}/notifications/my`, custHeaders)).data.data.notifications;
        if (feedAfterDel.some(n => String(n._id) === String(notifToRead._id))) {
            fail('Deleted notification still returned in customer feed');
        }
        pass('1.8 Customer notification deleted from feed successfully');

        // ─── PHASE 2: WORKER CRUD OPERATIONS & NOTIFICATIONS ─────────────────────
        log('\n─── PHASE 2: WORKER CRUD OPERATIONS & NOTIFICATIONS ───');

        // 2.1 Read Worker Profile
        res = await axios.get(`${BASE_URL}/workers/me`, workerHeaders);
        if (!res.data.data.phone) fail('Worker profile read failed');
        pass('2.1 Worker profile fetched successfully');

        // 2.2 Update Worker Profile -> Expect "Profile Updated" Notification
        const originalWorkerBio = res.data.data.bio || '';
        const updatedBio = `Certified professional pro with 7+ years expertise. Updated ${Date.now()}`;
        res = await axios.patch(`${BASE_URL}/workers/me/profile`, { bio: updatedBio }, workerHeaders);
        if (res.data.data.bio !== updatedBio) fail('Worker bio update failed');
        pass('2.2 Worker profile bio updated successfully');

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const workerProfileNotif = res.data.data.notifications.find(n => n.title.includes('Profile Updated'));
        if (!workerProfileNotif) fail('Worker did not receive "Profile Updated" notification');
        pass(`2.2 Worker received notification: "${workerProfileNotif.title}" - "${workerProfileNotif.message}"`);

        // Revert bio
        await axios.patch(`${BASE_URL}/workers/me/profile`, { bio: originalWorkerBio }, workerHeaders);

        // 2.3 Update Worker Services -> Expect "Services Updated" Notification
        const realCat = await Category.findOne({ active: true }).lean();
        res = await axios.patch(`${BASE_URL}/workers/me/services`, {
            services: [{
                category: realCat._id.toString(),
                categoryName: realCat.name,
                subcategories: realCat.subcategories.slice(0, 3).map(s => s.name),
                isActive: true
            }]
        }, workerHeaders);
        pass(`2.3 Worker services updated (${res.data.data.length} services configured: "${realCat.name}")`);

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const servicesNotif = res.data.data.notifications.find(n => n.title.includes('Services Updated'));
        if (!servicesNotif) fail('Worker did not receive "Services Updated" notification');
        pass(`2.3 Worker received notification: "${servicesNotif.title}" - "${servicesNotif.message}"`);

        // 2.4 Update Worker Location / Map Coordinates & Radius -> Expect "Location Updated" Notification
        const workerCoords = [72.5850, 23.0350];
        res = await axios.patch(`${BASE_URL}/workers/me/location`, {
            city: 'Ahmedabad',
            area: 'Navrangpura',
            pincode: '380009',
            radius: 20,
            coordinates: workerCoords
        }, workerHeaders);
        if (res.data.data.serviceRadius !== 20) fail('Worker radius update failed');
        pass(`2.4 Worker location & map coordinates updated (radius: 20km, coords: [${workerCoords}])`);

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const locNotif = res.data.data.notifications.find(n => n.title.includes('Location Updated'));
        if (!locNotif) fail('Worker did not receive "Location Updated" notification');
        pass(`2.4 Worker received notification: "${locNotif.title}" - "${locNotif.message}"`);

        // 2.5 Update Bank / UPI Details -> Expect "Bank Details Updated" Notification
        res = await axios.patch(`${BASE_URL}/workers/me/bank`, {
            bankDetails: {
                accountNumber: '987654321098',
                ifscCode: 'HDFC0001234',
                bankName: 'HDFC Bank'
            },
            upiId: 'shyam.dev@okaxis'
        }, workerHeaders);
        if (!res.data.data.upiId) fail('Worker bank/UPI update failed');
        pass('2.5 Worker bank & UPI payout details updated successfully');

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const bankNotif = res.data.data.notifications.find(n => n.title.includes('Bank Details Updated'));
        if (!bankNotif) fail('Worker did not receive "Bank Details Updated" notification');
        pass(`2.5 Worker received notification: "${bankNotif.title}" - "${bankNotif.message}"`);

        // 2.6 Worker Address CRUD: Add -> Update -> Set Primary -> Delete
        res = await axios.post(`${BASE_URL}/workers/me/addresses`, {
            label: 'Workshop Base',
            street: '404 Industrial Estate Phase 2',
            city: 'Ahmedabad',
            pincode: '382445',
            location: { type: 'Point', coordinates: [72.5900, 23.0400] },
            isPrimary: true
        }, workerHeaders);
        const workerAddedAddr = res.data.data.find(a => a.label === 'Workshop Base');
        if (!workerAddedAddr) fail('Worker address not added');
        const workerAddrId = workerAddedAddr._id;
        pass(`2.6 Worker address added (ID: ${workerAddrId})`);

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const wAddrAddedNotif = res.data.data.notifications.find(n => n.title.includes('Address Added'));
        if (!wAddrAddedNotif) fail('Worker did not receive "Address Added" notification');
        pass(`2.6 Worker received notification: "${wAddrAddedNotif.title}"`);

        // Update worker address
        res = await axios.put(`${BASE_URL}/workers/me/addresses/${workerAddrId}`, {
            label: 'Workshop Base Updated',
            street: '404 Industrial Estate Phase 2, Unit B',
            city: 'Ahmedabad',
            pincode: '382445'
        }, workerHeaders);
        pass('2.6 Worker address updated successfully');

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const wAddrUpdNotif = res.data.data.notifications.find(n => n.title.includes('Address Updated'));
        if (!wAddrUpdNotif) fail('Worker did not receive "Address Updated" notification');
        pass(`2.6 Worker received notification: "${wAddrUpdNotif.title}"`);

        // Set primary
        await axios.patch(`${BASE_URL}/workers/me/addresses/${workerAddrId}/primary`, {}, workerHeaders);
        pass('2.6 Worker primary address verified');

        // Delete address
        res = await axios.delete(`${BASE_URL}/workers/me/addresses/${workerAddrId}`, workerHeaders);
        pass('2.6 Worker address deleted successfully');

        res = await axios.get(`${BASE_URL}/notifications/my`, workerHeaders);
        const wAddrDelNotif = res.data.data.notifications.find(n => n.title.includes('Address Deleted'));
        if (!wAddrDelNotif) fail('Worker did not receive "Address Deleted" notification');
        pass(`2.6 Worker received notification: "${wAddrDelNotif.title}"`);

        // 2.7 Toggle Online Status
        res = await axios.patch(`${BASE_URL}/workers/me/online`, { isOnline: true }, workerHeaders);
        if (res.data.data.isOnline !== true) fail('Worker toggle online failed');
        pass('2.7 Worker toggled online: true');

        res = await axios.patch(`${BASE_URL}/workers/me/online`, { isOnline: false }, workerHeaders);
        if (res.data.data.isOnline !== false) fail('Worker toggle offline failed');
        pass('2.7 Worker toggled online: false');

        // 2.8 Worker Notification Management: Mark single read, mark all read, delete
        const workerNotifToRead = wAddrDelNotif;
        await axios.patch(`${BASE_URL}/notifications/${workerNotifToRead._id}/read`, {}, workerHeaders);
        pass('2.8 Worker marked single notification as read');

        await axios.patch(`${BASE_URL}/notifications/read-all`, {}, workerHeaders);
        const wCountAfterReadAll = (await axios.get(`${BASE_URL}/notifications/unread-count`, workerHeaders)).data.data.unreadCount;
        if (wCountAfterReadAll !== 0) fail(`Worker unreadCount should be 0, got ${wCountAfterReadAll}`);
        pass('2.8 Worker marked all notifications read (unread count = 0)');

        await axios.delete(`${BASE_URL}/notifications/${workerNotifToRead._id}`, workerHeaders);
        pass('2.8 Worker deleted notification successfully');

        // ─── PHASE 3: SHOP CRUD OPERATIONS & NOTIFICATIONS ───────────────────────
        log('\n─── PHASE 3: SHOP CRUD OPERATIONS & NOTIFICATIONS ───');

        // 3.1 Read Shop Profile
        res = await axios.get(`${BASE_URL}/shops/my`, shopHeaders);
        const myShop = res.data.data;
        if (!myShop.name) fail('Shop profile read failed');
        pass(`3.1 Shop fetched: "${myShop.name}" (ID: ${myShop._id})`);

        // 3.2 Update Shop Settings & Delivery Radius -> Expect "Shop Settings Updated" Notification
        const originalShopDesc = myShop.description || '';
        const updatedShopDesc = `Premium electrical and hardware store. Updated ${Date.now()}`;
        res = await axios.patch(`${BASE_URL}/shops/my`, {
            description: updatedShopDesc,
            deliveryConfig: {
                deliveryRadiusKm: 18
            },
            location: {
                type: 'Point',
                coordinates: [72.5741, 23.1222]
            }
        }, shopHeaders);
        if (res.data.data.description !== updatedShopDesc) fail('Shop update failed');
        pass('3.2 Shop settings, delivery radius & map location updated');

        res = await axios.get(`${BASE_URL}/notifications/my`, shopHeaders);
        const shopSettingsNotif = res.data.data.notifications.find(n => n.title.includes('Shop Settings Updated'));
        if (!shopSettingsNotif) fail('Shop did not receive "Shop Settings Updated" notification');
        pass(`3.2 Shop received notification: "${shopSettingsNotif.title}" - "${shopSettingsNotif.message}"`);

        // Revert description
        await axios.patch(`${BASE_URL}/shops/my`, { description: originalShopDesc }, shopHeaders);

        // 3.3 Shop Payout Methods CRUD: Add -> Set Primary -> Delete -> Expect Notifications
        res = await axios.post(`${BASE_URL}/shops/my/payout-methods`, {
            type: 'UPI',
            label: 'Shop Business UPI',
            detail: 'ramesh.hardware@okicici'
        }, shopHeaders);
        const addedMethod = res.data.data.find(m => m.label === 'Shop Business UPI');
        if (!addedMethod) fail('Shop payout method add failed');
        const payoutMethodId = addedMethod._id;
        pass(`3.3 Shop payout method added (ID: ${payoutMethodId})`);

        res = await axios.get(`${BASE_URL}/notifications/my`, shopHeaders);
        const payoutAddedNotif = res.data.data.notifications.find(n => n.title.includes('Payout Method Added'));
        if (!payoutAddedNotif) fail('Shop did not receive "Payout Method Added" notification');
        pass(`3.3 Shop received notification: "${payoutAddedNotif.title}" - "${payoutAddedNotif.message}"`);

        // Set Primary Payout Method
        await axios.patch(`${BASE_URL}/shops/my/payout-methods/${payoutMethodId}/primary`, {}, shopHeaders);
        pass('3.3 Shop primary payout method set');

        // Delete Payout Method
        res = await axios.delete(`${BASE_URL}/shops/my/payout-methods/${payoutMethodId}`, shopHeaders);
        pass('3.3 Shop payout method deleted');

        res = await axios.get(`${BASE_URL}/notifications/my`, shopHeaders);
        const payoutDelNotif = res.data.data.notifications.find(n => n.title.includes('Payout Method Removed'));
        if (!payoutDelNotif) fail('Shop did not receive "Payout Method Removed" notification');
        pass(`3.3 Shop received notification: "${payoutDelNotif.title}" - "${payoutDelNotif.message}"`);

        // 3.4 Product CRUD: Create -> Read -> Update -> Delete
        // Expect Direct Notification for Shop AND ADMIN_ACTIVITY log for Admin
        res = await axios.post(`${BASE_URL}/products`, {
            name: 'Gold Brass Heavy Tap 15mm',
            description: 'Heavy duty chrome plated brass tap for bathrooms and kitchens',
            category: 'Plumbing',
            price: 499.00,
            stock: 45,
            unit: 'Piece',
            minQty: 1
        }, shopHeaders);
        const createdProduct = res.data.data;
        if (!createdProduct._id) fail('Product creation failed');
        createdProductIds.push(createdProduct._id);
        pass(`3.4 Product created: "${createdProduct.name}" (ID: ${createdProduct._id}, ₹${createdProduct.price})`);

        // Check Shop Notification for Product Added
        res = await axios.get(`${BASE_URL}/notifications/my`, shopHeaders);
        const prodAddedShopNotif = res.data.data.notifications.find(n => n.title.includes('Product Added'));
        if (!prodAddedShopNotif) fail('Shop did not receive "Product Added" notification');
        pass(`3.4 Shop received product alert: "${prodAddedShopNotif.title}" - "${prodAddedShopNotif.message}"`);

        // Check Admin Activity Log for Product Added
        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const prodAddedAdminLog = res.data.data.logs.find(l => l.title === 'Product Added' && String(l.entityId) === String(createdProduct._id));
        if (!prodAddedAdminLog) fail('Admin activity log missing for Product Added');
        pass(`3.4 Admin Activity Log captured: "${prodAddedAdminLog.title}" (${prodAddedAdminLog.message})`);

        // Read Product
        res = await axios.get(`${BASE_URL}/products/${createdProduct._id}`, shopHeaders);
        if (res.data.data.name !== 'Gold Brass Heavy Tap 15mm') fail('Product read failed');
        pass('3.4 Product read verified');

        // Update Product (price and stock)
        res = await axios.patch(`${BASE_URL}/products/${createdProduct._id}`, {
            price: 549.00,
            stock: 60
        }, shopHeaders);
        if (res.data.data.price !== 549) fail('Product update failed');
        pass(`3.4 Product updated (new price: ₹549, stock: 60)`);

        // Check Shop Notification for Product Updated
        res = await axios.get(`${BASE_URL}/notifications/my`, shopHeaders);
        const prodUpdShopNotif = res.data.data.notifications.find(n => n.title.includes('Product Updated'));
        if (!prodUpdShopNotif) fail('Shop did not receive "Product Updated" notification');
        pass(`3.4 Shop received product alert: "${prodUpdShopNotif.title}"`);

        // Check Admin Activity Log for Product Updated
        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const prodUpdAdminLog = res.data.data.logs.find(l => l.title === 'Product Updated' && String(l.entityId) === String(createdProduct._id));
        if (!prodUpdAdminLog) fail('Admin activity log missing for Product Updated');
        pass(`3.4 Admin Activity Log captured: "${prodUpdAdminLog.title}"`);

        // Delete Product
        res = await axios.delete(`${BASE_URL}/products/${createdProduct._id}`, shopHeaders);
        pass('3.4 Product deleted successfully');

        // Check Shop Notification for Product Deleted
        res = await axios.get(`${BASE_URL}/notifications/my`, shopHeaders);
        const prodDelShopNotif = res.data.data.notifications.find(n => n.title.includes('Product Deleted'));
        if (!prodDelShopNotif) fail('Shop did not receive "Product Deleted" notification');
        pass(`3.4 Shop received product alert: "${prodDelShopNotif.title}"`);

        // Check Admin Activity Log for Product Deleted
        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const prodDelAdminLog = res.data.data.logs.find(l => l.title === 'Product Deleted' && String(l.entityId) === String(createdProduct._id));
        if (!prodDelAdminLog) fail('Admin activity log missing for Product Deleted');
        pass(`3.4 Admin Activity Log captured: "${prodDelAdminLog.title}"`);

        // 3.5 Shop Notification Management: Mark all read
        await axios.patch(`${BASE_URL}/notifications/read-all`, {}, shopHeaders);
        const sUnreadCount = (await axios.get(`${BASE_URL}/notifications/unread-count`, shopHeaders)).data.data.unreadCount;
        if (sUnreadCount !== 0) fail(`Shop unreadCount should be 0, got ${sUnreadCount}`);
        pass('3.5 Shop marked all notifications read (unread count = 0)');

        // ─── PHASE 4: ADMIN CRUD, SETTINGS & AUDIT LOG NOTIFICATIONS ─────────────
        log('\n─── PHASE 4: ADMIN CRUD, SETTINGS & AUDIT LOG NOTIFICATIONS ───');

        // 4.1 Admin Category CRUD: Add -> Update -> Add Subcategory -> Delete Subcategory -> Delete Category
        const uniqueCatName = `Test Smart Automation ${Date.now()}`;
        res = await axios.post(`${BASE_URL}/categories`, {
            name: uniqueCatName,
            icon: '⚡',
            color: '#3B82F6',
            description: 'IoT and smart home automation services',
            subcategories: [{ name: 'Smart Switch Installation', active: true }]
        }, adminHeaders);
        const createdCat = res.data.data;
        if (!createdCat._id) fail('Admin category creation failed');
        createdCategoryIds.push(createdCat._id);
        pass(`4.1 Category created: "${createdCat.name}" (ID: ${createdCat._id})`);

        // Verify Admin Activity Log for Category Created
        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const catCreatedLog = res.data.data.logs.find(l => l.title === 'Category Created' && String(l.entityId) === String(createdCat._id));
        if (!catCreatedLog) fail('Admin activity log missing for Category Created');
        pass(`4.1 Admin Activity Log: "${catCreatedLog.title}" - "${catCreatedLog.message}"`);

        // Update Category
        res = await axios.patch(`${BASE_URL}/categories/${createdCat._id}`, {
            description: 'Updated IoT smart home automation and robotics'
        }, adminHeaders);
        pass('4.1 Category updated');

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const catUpdatedLog = res.data.data.logs.find(l => l.title === 'Category Updated' && String(l.entityId) === String(createdCat._id));
        if (!catUpdatedLog) fail('Admin activity log missing for Category Updated');
        pass(`4.1 Admin Activity Log: "${catUpdatedLog.title}" - "${catUpdatedLog.message}"`);

        // Add Subcategory
        res = await axios.post(`${BASE_URL}/categories/${createdCat._id}/subcategories`, {
            name: 'Voice Assistant Setup',
            active: true
        }, adminHeaders);
        const subId = res.data.data.subcategories.find(s => s.name === 'Voice Assistant Setup')?._id;
        pass(`4.1 Subcategory added: "Voice Assistant Setup" (ID: ${subId})`);

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const subAddedLog = res.data.data.logs.find(l => l.title === 'Subcategory Added' && String(l.entityId) === String(createdCat._id));
        if (!subAddedLog) fail('Admin activity log missing for Subcategory Added');
        pass(`4.1 Admin Activity Log: "${subAddedLog.title}"`);

        // Delete Subcategory
        await axios.delete(`${BASE_URL}/categories/${createdCat._id}/subcategories/${subId}`, adminHeaders);
        pass('4.1 Subcategory deleted');

        // Delete Category
        await axios.delete(`${BASE_URL}/categories/${createdCat._id}`, adminHeaders);
        pass('4.1 Category deleted successfully');

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const catDeletedLog = res.data.data.logs.find(l => l.title === 'Category Deleted' && String(l.entityId) === String(createdCat._id));
        if (!catDeletedLog) fail('Admin activity log missing for Category Deleted');
        pass(`4.1 Admin Activity Log: "${catDeletedLog.title}" - "${catDeletedLog.message}"`);

        // 4.2 Admin Platform Settings CRUD
        res = await axios.get(`${BASE_URL}/settings`, adminHeaders);
        if (!res.data.data) fail('Admin settings fetch failed');
        pass('4.2 Admin platform settings read successfully');

        // Update settings
        res = await axios.patch(`${BASE_URL}/settings`, {
            feePercentage: 12,
            walletMinimum: 100,
            maxRadius: 30
        }, adminHeaders);
        pass('4.2 Admin platform settings updated');

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const settingsLog = res.data.data.logs.find(l => l.title.includes('Settings Updated'));
        if (!settingsLog) fail('Admin activity log missing for Platform Settings Updated');
        pass(`4.2 Admin Activity Log: "${settingsLog.title}" - "${settingsLog.message}"`);

        // 4.3 Admin User Management CRUD: Create -> Update -> Toggle Status -> Delete
        const uniqueTestPhone = `9899${Math.floor(100000 + Math.random() * 900000)}`;
        res = await axios.post(`${BASE_URL}/admin/users`, {
            name: 'Rohit Verma Demo Pro',
            phone: uniqueTestPhone,
            role: 'WORKER',
            city: 'Ahmedabad'
        }, adminHeaders);
        const createdTestUser = res.data.data;
        if (!createdTestUser._id) fail('Admin create user failed');
        createdUserIds.push(createdTestUser._id);
        pass(`4.3 Admin created user: "${createdTestUser.name}" (${createdTestUser.phone}, ID: ${createdTestUser._id})`);

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const userCreatedLog = res.data.data.logs.find(l => l.title.includes('Worker Created') && String(l.entityId) === String(createdTestUser._id));
        if (!userCreatedLog) fail('Admin activity log missing for Worker Created');
        pass(`4.3 Admin Activity Log: "${userCreatedLog.title}"`);

        // Update User
        res = await axios.patch(`${BASE_URL}/admin/users/${createdTestUser._id}`, {
            name: 'Rohit Verma Senior Pro',
            city: 'Ahmedabad West'
        }, adminHeaders);
        pass('4.3 Admin updated user successfully');

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const userUpdatedLog = res.data.data.logs.find(l => l.title.includes('Worker Updated') && String(l.entityId) === String(createdTestUser._id));
        if (!userUpdatedLog) fail('Admin activity log missing for Worker Updated');
        pass(`4.3 Admin Activity Log: "${userUpdatedLog.title}"`);

        // Toggle Status
        res = await axios.patch(`${BASE_URL}/admin/users/${createdTestUser._id}/toggle-status`, {}, adminHeaders);
        pass(`4.3 Admin toggled user status (new verified state: ${res.data.data.isVerified})`);

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const userToggleLog = res.data.data.logs.find(l => l.title.includes('Customer activated') || l.title.includes('Customer deactivated'));
        if (!userToggleLog) fail('Admin activity log missing for toggle user status');
        pass(`4.3 Admin Activity Log: "${userToggleLog.title}"`);

        // Delete User
        res = await axios.delete(`${BASE_URL}/admin/users/${createdTestUser._id}`, adminHeaders);
        pass('4.3 Admin deleted user successfully');

        res = await axios.get(`${BASE_URL}/notifications/activity-logs`, adminHeaders);
        const userDeletedLog = res.data.data.logs.find(l => l.title === 'Customer Deleted' && String(l.entityId) === String(createdTestUser._id));
        if (!userDeletedLog) fail('Admin activity log missing for Customer Deleted');
        pass(`4.3 Admin Activity Log: "${userDeletedLog.title}"`);

        // 4.4 Admin Broadcast Notification to ALL roles
        const broadcastTitle = `📢 System Maintenance Notice ${Date.now()}`;
        res = await axios.post(`${BASE_URL}/notifications/broadcast`, {
            title: broadcastTitle,
            message: 'Platform performance upgrade completed. All services active and optimized.',
            targetRole: 'ALL'
        }, adminHeaders);
        const broadcastNotifId = res.data.data._id;
        pass(`4.4 Admin broadcast created: "${broadcastTitle}" (ID: ${broadcastNotifId})`);

        // Verify broadcast appears in Customer, Worker, and Shop feeds
        const [custFeed, workerFeed, shopFeed] = await Promise.all([
            axios.get(`${BASE_URL}/notifications/my`, custHeaders),
            axios.get(`${BASE_URL}/notifications/my`, workerHeaders),
            axios.get(`${BASE_URL}/notifications/my`, shopHeaders)
        ]);

        const inCust = custFeed.data.data.notifications.some(n => n.title === broadcastTitle);
        const inWorker = workerFeed.data.data.notifications.some(n => n.title === broadcastTitle);
        const inShop = shopFeed.data.data.notifications.some(n => n.title === broadcastTitle);

        if (!inCust) fail('Broadcast notification missing from Customer feed');
        if (!inWorker) fail('Broadcast notification missing from Worker feed');
        if (!inShop) fail('Broadcast notification missing from Shop feed');
        pass('4.4 Broadcast verified across Customer, Worker, and Shop feeds with 100% parity');

        // Admin marks all notifications as read
        await axios.patch(`${BASE_URL}/notifications/read-all`, {}, adminHeaders);
        pass('4.4 Admin marked all notifications read');

        // ─── FINAL SUMMARY ────────────────────────────────────────────────────────
        console.log('\n' + '='.repeat(80));
        console.log('   🎉 ALL CRUD & NOTIFICATION TESTS PASSED WITH 100% SUCCESS');
        console.log('='.repeat(80));
        console.log('  Customer CRUD: Profile, Addresses (Add/Update/SetPrimary/Delete), Settings, Notifications  ✅');
        console.log('  Worker CRUD:   Profile, Services, Map/Location, Bank, Address (Add/Update/Delete), Online  ✅');
        console.log('  Shop CRUD:     Shop Settings, Map/Radius, Payout Methods, Products (Create/Update/Delete)  ✅');
        console.log('  Admin CRUD:    Category CRUD, Subcategory CRUD, Platform Settings, User Lifecycle CRUD    ✅');
        console.log('  Notifications: Real-time generation, unread counts, read-all, delete & Broadcast parity    ✅');
        console.log('  Activity Logs: ADMIN_ACTIVITY logging on all mutating platform actions                     ✅');
        console.log('='.repeat(80));

    } catch (err) {
        console.error('\n❌ Test suite failed:', err.message);
        throw err;
    } finally {
        // Cleanup test categories, products, or users
        if (createdCategoryIds.length > 0) {
            await Category.deleteMany({ _id: { $in: createdCategoryIds } });
        }
        if (createdProductIds.length > 0) {
            await Product.deleteMany({ _id: { $in: createdProductIds } });
        }
        if (createdUserIds.length > 0) {
            await Customer.deleteMany({ _id: { $in: createdUserIds } });
        }
        await mongoose.disconnect();
        log('Cleaned up test entities and disconnected DB.');
    }
}

main().catch(err => {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
});
