const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
if (!process.env.MONGO_URI) {
    require('dotenv').config();
}

const Shop = require('./src/modules/shop/shop.model');
const Product = require('./src/modules/product/product.model');

const generateProducts = (shop, index) => {
    const categoryName = shop.category || 'General';
    const products = [];
    
    const groceryItems = [
        { name: 'Aashirvaad Whole Wheat Atta 5kg', price: 210, unit: 'Kg' },
        { name: 'India Gate Basmati Rice 5kg', price: 450, unit: 'Kg' },
        { name: 'Fortune Sunlite Refined Sunflower Oil 1L', price: 140, unit: 'Liter' },
        { name: 'Tata Salt 1kg', price: 25, unit: 'Kg' },
        { name: 'Madhur Sugar 1kg', price: 50, unit: 'Kg' },
        { name: 'Toor Dal (Premium) 1kg', price: 160, unit: 'Kg' },
        { name: 'Moong Dal 1kg', price: 110, unit: 'Kg' },
        { name: 'Everest Turmeric Powder 200g', price: 65, unit: 'Gram' },
        { name: 'Maggi 2-Minute Noodles 6-Pack', price: 84, unit: 'Pack' },
        { name: 'Kissan Tomato Ketchup 1kg', price: 130, unit: 'Bottle' },
        { name: 'Brooke Bond Red Label Tea 500g', price: 280, unit: 'Gram' },
        { name: 'Nescafe Classic Coffee 50g', price: 175, unit: 'Gram' },
        { name: 'Amul Butter 100g', price: 56, unit: 'Box' },
        { name: 'Britannia Good Day Biscuits 200g', price: 40, unit: 'Pack' },
        { name: 'Haldiram Aloo Bhujia 400g', price: 90, unit: 'Pack' },
        { name: 'Surf Excel Easy Wash 1kg', price: 120, unit: 'Kg' },
        { name: 'Vim Dishwash Gel 500ml', price: 110, unit: 'Bottle' },
        { name: 'Dettol Handwash Liquid 750ml', price: 99, unit: 'Bottle' },
        { name: 'Colgate MaxFresh Toothpaste 150g', price: 110, unit: 'Pack' },
        { name: 'Himalaya Purifying Neem Facewash 100ml', price: 140, unit: 'Piece' }
    ];

    const dairyItems = [
        { name: 'Amul Taaza Milk (Toned) 500ml', price: 27, unit: 'Pouch' },
        { name: 'Amul Gold Milk (Full Cream) 500ml', price: 33, unit: 'Pouch' },
        { name: 'Amul Masti Dahi 400g', price: 35, unit: 'Box' },
        { name: 'Amul Paneer 200g', price: 90, unit: 'Pack' },
        { name: 'Amul Cheese Slices 200g', price: 130, unit: 'Pack' },
        { name: 'Amul Butter Milk 500ml', price: 15, unit: 'Pouch' },
        { name: 'Britannia White Bread 400g', price: 45, unit: 'Pack' },
        { name: 'Britannia Whole Wheat Bread 400g', price: 55, unit: 'Pack' },
        { name: 'Fresh Bun (Pack of 4)', price: 30, unit: 'Pack' },
        { name: 'Chocolate Truffle Cake 500g', price: 450, unit: 'Piece' },
        { name: 'Black Forest Cake 500g', price: 400, unit: 'Piece' },
        { name: 'Pineapple Pastry', price: 60, unit: 'Piece' },
        { name: 'Chocolate Muffins 2pcs', price: 80, unit: 'Pack' },
        { name: 'Butter Croissant', price: 75, unit: 'Piece' },
        { name: 'Veg Puff / Patties', price: 25, unit: 'Piece' },
        { name: 'Milk Rusk (Toast) 300g', price: 55, unit: 'Pack' },
        { name: 'Khari Biscuit 250g', price: 60, unit: 'Box' },
        { name: 'Jeera Butter Cookies 250g', price: 120, unit: 'Box' },
        { name: 'Nutella Hazelnut Spread 350g', price: 350, unit: 'Bottle' },
        { name: 'Hersheys Chocolate Syrup 623g', price: 190, unit: 'Bottle' }
    ];

    const pharmacyItems = [
        { name: 'Crocin Pain Relief Tablet 15s', price: 45, unit: 'Pack' },
        { name: 'Dolo 650mg Tablet 15s', price: 32, unit: 'Pack' },
        { name: 'Vicks Vaporub 50g', price: 95, unit: 'Bottle' },
        { name: 'Honitus Cough Syrup 100ml', price: 110, unit: 'Bottle' },
        { name: 'Digene Antacid Gel 200ml', price: 145, unit: 'Bottle' },
        { name: 'Eno Fruit Salt (Regular) 100g', price: 55, unit: 'Bottle' },
        { name: 'Volini Pain Relief Spray 60g', price: 160, unit: 'Bottle' },
        { name: 'Moov Pain Relief Cream 50g', price: 150, unit: 'Pack' },
        { name: 'Pudin Hara Pearls 10s', price: 25, unit: 'Pack' },
        { name: 'Band-Aid Washproof 20s', price: 80, unit: 'Box' },
        { name: 'Betadine Ointment 15g', price: 125, unit: 'Pack' },
        { name: 'Savlon Antiseptic Liquid 500ml', price: 105, unit: 'Bottle' },
        { name: 'Himalaya Ashvagandha 60s', price: 160, unit: 'Bottle' },
        { name: 'Revital H Daily Supplement 30s', price: 330, unit: 'Bottle' },
        { name: 'Ensure Diabetes Care 400g', price: 680, unit: 'Box' },
        { name: 'Shelcal 500 Tablet 15s', price: 120, unit: 'Pack' },
        { name: 'ORSL Apple Drink 200ml', price: 42, unit: 'Piece' },
        { name: 'Otrivin Nasal Spray 10ml', price: 90, unit: 'Bottle' },
        { name: 'Sensodyne Toothpaste 75g', price: 135, unit: 'Pack' },
        { name: 'Dettol Sanitizer 50ml', price: 50, unit: 'Bottle' }
    ];

    const vegItems = [
        { name: 'Onion 1kg', price: 40, unit: 'Kg' },
        { name: 'Potato 1kg', price: 30, unit: 'Kg' },
        { name: 'Tomato 1kg', price: 50, unit: 'Kg' },
        { name: 'Green Chilli 100g', price: 15, unit: 'Gram' },
        { name: 'Coriander Leaves 1 bunch', price: 20, unit: 'Piece' },
        { name: 'Lemon 250g', price: 40, unit: 'Gram' },
        { name: 'Ginger 100g', price: 30, unit: 'Gram' },
        { name: 'Garlic 200g', price: 40, unit: 'Gram' },
        { name: 'Cauliflower 1pc', price: 45, unit: 'Piece' },
        { name: 'Cabbage 1pc', price: 35, unit: 'Piece' },
        { name: 'Carrot 1kg', price: 60, unit: 'Kg' },
        { name: 'Capsicum 500g', price: 80, unit: 'Gram' },
        { name: 'Bottle Gourd (Lauki) 1pc', price: 40, unit: 'Piece' },
        { name: 'Bitter Gourd (Karela) 500g', price: 50, unit: 'Gram' },
        { name: 'Lady Finger (Bhindi) 500g', price: 45, unit: 'Gram' },
        { name: 'Spinach (Palak) 1 bunch', price: 30, unit: 'Piece' },
        { name: 'Mint Leaves (Pudina) 1 bunch', price: 15, unit: 'Piece' },
        { name: 'Brinjal (Bharta) 500g', price: 45, unit: 'Gram' },
        { name: 'Sweet Corn 1pc', price: 25, unit: 'Piece' },
        { name: 'Mushroom (Button) 200g', price: 55, unit: 'Pack' }
    ];

    const electronicsItems = [
        { name: 'boAt Rockerz 450 Bluetooth Headphone', price: 1299, unit: 'Piece' },
        { name: 'JBL C100SI Wired Earphones', price: 599, unit: 'Piece' },
        { name: 'SanDisk 64GB Pen Drive', price: 450, unit: 'Piece' },
        { name: 'Samsung 25W Type-C Charger', price: 1199, unit: 'Piece' },
        { name: 'Duracell AA Batteries 4-Pack', price: 160, unit: 'Pack' },
        { name: 'Mi 10000mAh Power Bank', price: 1099, unit: 'Piece' },
        { name: 'Logitech B170 Wireless Mouse', price: 645, unit: 'Piece' },
        { name: 'HP K1500 Wired Keyboard', price: 499, unit: 'Piece' },
        { name: 'Portronics 4-Port USB Hub', price: 299, unit: 'Piece' },
        { name: 'HDMI Cable (1.5 Meter)', price: 250, unit: 'Piece' },
        { name: 'Syska 9W LED Bulb', price: 99, unit: 'Piece' },
        { name: 'Boat Type-C Charging Cable', price: 199, unit: 'Piece' },
        { name: 'Zebronics Wired PC Speakers', price: 399, unit: 'Set' },
        { name: 'TP-Link N300 Wi-Fi Router', price: 999, unit: 'Piece' },
        { name: 'Sony 32GB MicroSD Card', price: 350, unit: 'Piece' },
        { name: 'Philips Trimmer BT1232', price: 899, unit: 'Piece' },
        { name: 'Havells Immersion Water Heater', price: 650, unit: 'Piece' },
        { name: 'Crompton 1200mm Ceiling Fan', price: 1450, unit: 'Piece' },
        { name: 'Bajaj 1000W Dry Iron', price: 550, unit: 'Piece' },
        { name: 'Oriya 4-Socket Extension Board', price: 450, unit: 'Piece' }
    ];

    let itemsSource = groceryItems;
    if (categoryName.toLowerCase().includes('dairy') || categoryName.toLowerCase().includes('bakery')) itemsSource = dairyItems;
    if (categoryName.toLowerCase().includes('pharmacy')) itemsSource = pharmacyItems;
    if (categoryName.toLowerCase().includes('veg')) itemsSource = vegItems;
    if (categoryName.toLowerCase().includes('electronic')) itemsSource = electronicsItems;

    itemsSource.forEach((item, i) => {
        // Generate a fun placeholder image using via.placeholder.com
        const color = ['f00', '0f0', '00f', 'ff0', '0ff', 'f0f'][i % 6];
        const textStr = encodeURIComponent(item.name.substring(0, 15));
        
        let attributes = [];
        if (categoryName.toLowerCase().includes('electronic')) {
            attributes = [
                { name: 'Color', value: i % 2 === 0 ? 'Black' : 'White' },
                { name: 'Warranty', value: '1 Year' },
                { name: 'Condition', value: 'New' }
            ];
        } else if (categoryName.toLowerCase().includes('pharmacy')) {
            attributes = [
                { name: 'Prescription Required', value: 'No' },
                { name: 'Type', value: item.unit === 'Bottle' ? 'Liquid' : 'Solid' }
            ];
        } else if (categoryName.toLowerCase().includes('veg')) {
            attributes = [
                { name: 'Farming Type', value: i % 2 === 0 ? 'Organic' : 'Regular' },
                { name: 'Quality', value: 'Premium Fresh' }
            ];
        } else if (categoryName.toLowerCase().includes('dairy') || categoryName.toLowerCase().includes('bakery')) {
            attributes = [
                { name: 'Dietary Preference', value: 'Vegetarian (Eggless)' },
                { name: 'Storage', value: 'Keep Refrigerated' }
            ];
        } else {
            attributes = [
                { name: 'Origin', value: 'India' },
                { name: 'Type', value: '100% Pure & Authentic' }
            ];
        }

        products.push({
            shopId: shop._id,
            name: item.name,
            price: item.price,
            category: categoryName,
            brand: 'Local',
            unit: item.unit,
            description: `Fresh and high quality ${item.name} for your everyday needs.`,
            stock: 50, // 50 items in stock
            minQty: 1,
            isActive: true,
            imageUrl: `https://via.placeholder.com/200/${color}/fff.png?text=${textStr}`,
            attributes: attributes
        });
    });

    return products;
};

const seedProducts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find the 5 shops we just seeded in Chandkheda
        const shops = await Shop.find({ 
            address: { $regex: /Chandkheda/i }
        });

        if (shops.length === 0) {
            console.log('No shops found in Chandkheda. Run seed_shops first.');
            return;
        }

        console.log(`Found ${shops.length} shops. Generating products...`);
        let allProducts = [];

        for (const shop of shops) {
            // Delete existing products for this shop first so we don't duplicate
            await Product.deleteMany({ shopId: shop._id });
            
            const products = generateProducts(shop, 0);
            allProducts = allProducts.concat(products);
            console.log(`Generated ${products.length} products for shop: ${shop.name}`);
        }

        await Product.insertMany(allProducts);
        console.log(`Successfully inserted ${allProducts.length} products total!`);

    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        mongoose.disconnect();
    }
};

seedProducts();
