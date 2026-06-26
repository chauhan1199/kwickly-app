const mongoose = require('mongoose');
const Category = require('./src/modules/category/category.model');

const newCategories = [
  "Car service",
  "Painting & waterproofing",
  "Beauty & saloon at home",
  "Fitness & wellness",
  "Baby & childcare",
  "Home tution & education",
  "Cook & food service",
  "Event & Decoration",
  "Astrology & spiritual service",
  "Pool, gym & special maintenance",
  "It & software development",
  "Digital marketing & business",
  "Hr & staffing service",
  "Sports & outdoor service",
  "Pest control service",
  "Home appliance repair",
  "Bike two wheeler service",
  "Carpentry & furniture",
  "Spa & massge therapy"
];

async function seed() {
    await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
    
    const cats = newCategories.map(name => ({
        name,
        imageUrl: null,
        active: true,
        subcategories: []
    }));

    for (const cat of cats) {
        const exists = await Category.findOne({ name: new RegExp('^' + cat.name + '$', 'i') });
        if (!exists) {
            await Category.create(cat);
            console.log(`Added: ${cat.name}`);
        } else {
            console.log(`Skipped existing: ${cat.name}`);
        }
    }

    console.log('Done adding new categories');
    
    // Clear cache
    const { delCache } = require('./src/helpers/redis.helper');
    await delCache('categories_list');

    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
