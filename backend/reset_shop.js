const mongoose = require("mongoose");
const Shop = require("./src/modules/shop/shop.model");
const Customer = require("./src/modules/customer/customer.model");
const Product = require("./src/modules/product/product.model");

mongoose.connect("mongodb://127.0.0.1:27017/kwickly").then(async () => {
    try {
        console.log("Cleaning shops and products...");
        await Shop.deleteMany({});
        await Product.deleteMany({});
        
        console.log("Fetching a customer to act as owner...");
        const owner = await Customer.findOne({});
        if (!owner) {
            console.log("No customer found! Please create one first.");
            process.exit(1);
        }

        console.log("Creating Vegetable Shop...");
        const shop = await Shop.create({
            ownerId: owner._id,
            name: "Green Valley Veggies",
            category: "Vegetables",
            description: "Fresh, organic, and daily harvested vegetables straight from the farm.",
            logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80",
            address: "123 Green Market Road, VeggieTown",
            location: {
                type: "Point",
                coordinates: [77.2090, 28.6139] // Delhi coords for default
            },
            businessHours: {
                monFri: "7 AM - 9 PM",
                sat: "7 AM - 9 PM",
                sun: "7 AM - 2 PM"
            },
            delivery: {
                radiusKm: 5,
                fee: 20,
                freeAbove: 300
            },
            isOnline: true,
            rating: 4.8,
            totalOrders: 150
        });

        console.log("Creating sample vegetable products...");
        const products = [
            {
                shopId: shop._id,
                name: "Fresh Tomatoes",
                category: "Vegetables",
                price: 40,
                unit: "1 kg",
                description: "Farm fresh red tomatoes",
                inStock: true,
                images: ["https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=500&q=80"]
            },
            {
                shopId: shop._id,
                name: "Organic Spinach",
                category: "Vegetables",
                price: 25,
                unit: "1 bunch",
                description: "Green organic spinach leaves",
                inStock: true,
                images: ["https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=500&q=80"]
            },
            {
                shopId: shop._id,
                name: "Potatoes",
                category: "Vegetables",
                price: 35,
                unit: "1 kg",
                description: "Fresh golden potatoes",
                inStock: true,
                images: ["https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=500&q=80"]
            }
        ];

        await Product.insertMany(products);

        console.log("Shop and Products created successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
});
