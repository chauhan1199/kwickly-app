const mongoose = require('mongoose');
const Category = require('./src/modules/category/category.model');

async function seed() {
    await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
    console.log('Connected to DB');

    await Category.deleteMany({});
    console.log('Cleared existing categories');

    const cats = [
        {
            name: 'Home Cleaning',
            imageUrl: 'http://localhost:5000/uploads/dummy-cleaning.jpg',
            active: true,
            subcategories: [
                { name: 'Full House Cleaning', active: true },
                { name: 'Sofa Cleaning', active: true },
                { name: 'Bathroom Cleaning', active: true }
            ]
        },
        {
            name: 'Plumbing',
            imageUrl: 'http://localhost:5000/uploads/dummy-plumbing.jpg',
            active: true,
            subcategories: [
                { name: 'Pipe Leak Repair', active: true },
                { name: 'Tap Installation', active: true },
                { name: 'Drain Blockage', active: true }
            ]
        },
        {
            name: 'Electrical',
            imageUrl: 'http://localhost:5000/uploads/dummy-electrical.jpg',
            active: true,
            subcategories: [
                { name: 'Switch Repair', active: true },
                { name: 'Fan Installation', active: true },
                { name: 'Wiring Issues', active: true }
            ]
        }
    ];

    await Category.insertMany(cats);
    console.log('Inserted 3 dummy categories successfully');

    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
