const mongoose = require('mongoose');
const Category = require('./src/modules/category/category.model');

const subcategoryMap = {
  "Car service": ["Car Wash", "Car Detailing", "Engine Repair"],
  "Painting & waterproofing": ["Interior Painting", "Exterior Painting", "Waterproofing Solutions"],
  "Beauty & saloon at home": ["Haircut & Styling", "Facial & Skin Care", "Manicure & Pedicure"],
  "Fitness & wellness": ["Personal Trainer", "Yoga Classes", "Zumba & Aerobics"],
  "Baby & childcare": ["Babysitting", "Nanny Services", "Child Care Consultant"],
  "Home tution & education": ["Math Tutoring", "Science Tutoring", "Language Lessons"],
  "Cook & food service": ["Personal Chef", "Daily Tiffin Service", "Party Catering"],
  "Event & Decoration": ["Wedding Planning", "Birthday Decoration", "Corporate Events"],
  "Astrology & spiritual service": ["Horoscope Reading", "Tarot Card Reading", "Vastu Consultation"],
  "Pool, gym & special maintenance": ["Pool Cleaning", "Gym Equipment Repair", "Specialized Sanitization"],
  "It & software development": ["Website Development", "Mobile App Development", "IT Support"],
  "Digital marketing & business": ["SEO Services", "Social Media Management", "Business Consulting"],
  "Hr & staffing service": ["Recruitment Services", "Payroll Management", "Staff Training"],
  "Sports & outdoor service": ["Tennis Coaching", "Swimming Lessons", "Golf Instructor"],
  "Pest control service": ["General Pest Control", "Termite Treatment", "Bed Bug Control"],
  "Home appliance repair": ["AC Repair", "Washing Machine Repair", "Refrigerator Repair"],
  "Bike two wheeler service": ["Bike Servicing", "Engine Tune-up", "Flat Tire Repair"],
  "Carpentry & furniture": ["Furniture Repair", "Custom Furniture Design", "Door & Window Fitting"],
  "Spa & massge therapy": ["Swedish Massage", "Deep Tissue Massage", "Aromatherapy Therapy"]
};

async function seedSubcategories() {
    await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
    console.log('Connected to DB');

    for (const [catName, subNames] of Object.entries(subcategoryMap)) {
        const category = await Category.findOne({ name: new RegExp('^' + catName + '$', 'i') });
        if (category) {
            // Check existing to prevent duplicates
            const existingSubNames = category.subcategories.map(s => s.name.toLowerCase());
            let updated = false;

            for (const name of subNames) {
                if (!existingSubNames.includes(name.toLowerCase())) {
                    category.subcategories.push({ name, active: true });
                    updated = true;
                }
            }

            if (updated) {
                await category.save();
                console.log(`Updated subcategories for: ${catName}`);
            } else {
                console.log(`No new subcategories for: ${catName}`);
            }
        } else {
            console.log(`Category not found: ${catName}`);
        }
    }

    // Clear cache
    const { delCache } = require('./src/helpers/redis.helper');
    await delCache('categories_list');
    console.log('Cleared category cache');

    process.exit(0);
}

seedSubcategories().catch(err => {
    console.error(err);
    process.exit(1);
});
