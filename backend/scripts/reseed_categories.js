require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/modules/category/category.model');

const categories = [
  { name: 'Home Services', icon: '🏠', color: '#2563EB', description: 'AC, appliance repair, electrical, plumbing services.', active: true,
    subcategories: [
      { name: 'AC Services', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'AC Installation', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'AC Repair', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
      { name: 'AC Gas Refilling', minPrice: 1200, platformFee: 250, suggestedMax: 3500, active: true },
      { name: 'AC Deep Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
      { name: 'Refrigerator Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Washing Machine Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Microwave Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'TV Repair', minPrice: 499, platformFee: 100, suggestedMax: 3000, active: true },
      { name: 'Geyser Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Water Purifier Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'Fan Installation', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Light Installation', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
      { name: 'Switch Repair', minPrice: 99, platformFee: 20, suggestedMax: 300, active: true },
      { name: 'Wiring Repair', minPrice: 499, platformFee: 100, suggestedMax: 3000, active: true },
      { name: 'Inverter Installation', minPrice: 799, platformFee: 160, suggestedMax: 2500, active: true },
      { name: 'Tap Repair', minPrice: 199, platformFee: 40, suggestedMax: 600, active: true },
      { name: 'Pipe Leakage', minPrice: 249, platformFee: 50, suggestedMax: 800, active: true },
      { name: 'Drain Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Toilet Repair', minPrice: 299, platformFee: 60, suggestedMax: 1000, active: true },
      { name: 'Water Tank Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
      { name: 'Motor Installation', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Bathroom Fittings', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true }
    ]
  },
  { name: 'Cleaning Services', icon: '🧹', color: '#10B981', description: 'Home, deep, sofa, commercial cleaning services.', active: true,
    subcategories: [
      { name: 'Full Home Cleaning', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Kitchen Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1000, active: true },
      { name: 'Bathroom Cleaning', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Deep Cleaning', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'Sofa Cleaning', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Carpet Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
      { name: 'Mattress Cleaning', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Curtain Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Office Cleaning', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
      { name: 'Shop Cleaning', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Restaurant Cleaning', minPrice: 2499, platformFee: 500, suggestedMax: 10000, active: true }
    ]
  },
  { name: 'Painting Services', icon: '🎨', color: '#8B5CF6', description: 'Interior, exterior, texture painting services.', active: true,
    subcategories: [
      { name: 'Room Painting', minPrice: 1999, platformFee: 400, suggestedMax: 5000, active: true },
      { name: 'Full House Painting', minPrice: 9999, platformFee: 2000, suggestedMax: 30000, active: true },
      { name: 'Texture Painting', minPrice: 3999, platformFee: 800, suggestedMax: 10000, active: true },
      { name: 'Exterior Painting', minPrice: 4999, platformFee: 1000, suggestedMax: 15000, active: true },
      { name: 'Waterproof Painting', minPrice: 2999, platformFee: 600, suggestedMax: 8000, active: true }
    ]
  },
  { name: 'Carpentry Services', icon: '🪚', color: '#D97706', description: 'Furniture repair, woodwork, modular services.', active: true,
    subcategories: [
      { name: 'Furniture Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Furniture Assembly', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'Custom Furniture', minPrice: 4999, platformFee: 1000, suggestedMax: 20000, active: true },
      { name: 'Door Repair', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Window Repair', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Cabinet Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Modular Furniture', minPrice: 4999, platformFee: 1000, suggestedMax: 25000, active: true }
    ]
  },
  { name: 'Pest Control', icon: '🐛', color: '#EF4444', description: 'Residential and commercial pest control.', active: true,
    subcategories: [
      { name: 'Cockroach Control', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Termite Control', minPrice: 1999, platformFee: 400, suggestedMax: 5000, active: true },
      { name: 'Bed Bug Treatment', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Mosquito Control', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
      { name: 'Rodent Control', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Office Pest Control', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'Restaurant Pest Control', minPrice: 2499, platformFee: 500, suggestedMax: 8000, active: true }
    ]
  },
  { name: 'Home Renovation', icon: '🏗️', color: '#6366F1', description: 'Civil work, tiles, flooring, interior design.', active: true,
    subcategories: [
      { name: 'Tiles Installation', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
      { name: 'Flooring', minPrice: 2999, platformFee: 600, suggestedMax: 15000, active: true },
      { name: 'Mason Work', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'False Ceiling', minPrice: 3999, platformFee: 800, suggestedMax: 12000, active: true },
      { name: 'Modular Kitchen', minPrice: 19999, platformFee: 4000, suggestedMax: 50000, active: true },
      { name: 'Wardrobe Design', minPrice: 9999, platformFee: 2000, suggestedMax: 30000, active: true },
      { name: 'Home Interior', minPrice: 14999, platformFee: 3000, suggestedMax: 50000, active: true }
    ]
  },
  { name: 'Security Services', icon: '🔒', color: '#1E293B', description: 'CCTV, access control, fire safety services.', active: true,
    subcategories: [
      { name: 'CCTV Installation', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
      { name: 'CCTV Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Access Control', minPrice: 3999, platformFee: 800, suggestedMax: 15000, active: true },
      { name: 'Fire Alarm Installation', minPrice: 2499, platformFee: 500, suggestedMax: 8000, active: true },
      { name: 'Fire Safety Inspection', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true }
    ]
  },
  { name: 'Gardening Services', icon: '🌿', color: '#059669', description: 'Lawn care, tree trimming, landscaping.', active: true,
    subcategories: [
      { name: 'Lawn Mowing', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Tree Trimming', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Plant Maintenance', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
      { name: 'Landscaping', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
      { name: 'Garden Design', minPrice: 4999, platformFee: 1000, suggestedMax: 20000, active: true },
      { name: 'Vertical Garden', minPrice: 3999, platformFee: 800, suggestedMax: 12000, active: true }
    ]
  },
  { name: 'Moving & Shifting', icon: '📦', color: '#0EA5E9', description: 'House shifting, packers and movers.', active: true,
    subcategories: [
      { name: 'Local Shifting', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
      { name: 'Intercity Shifting', minPrice: 7999, platformFee: 1600, suggestedMax: 30000, active: true },
      { name: 'Packing Service', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Loading Service', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
      { name: 'Unloading Service', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true }
    ]
  },
  { name: 'Beauty & Salon', icon: '💇', color: '#EC4899', description: 'At-home salon for women and men.', active: true,
    subcategories: [
      { name: 'Women Haircut', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Hair Spa', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Hair Coloring', minPrice: 799, platformFee: 160, suggestedMax: 3000, active: true },
      { name: 'Facial', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Waxing', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'Manicure', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Pedicure', minPrice: 349, platformFee: 70, suggestedMax: 1000, active: true },
      { name: 'Makeup', minPrice: 999, platformFee: 200, suggestedMax: 5000, active: true },
      { name: 'Men Haircut', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
      { name: 'Beard Styling', minPrice: 149, platformFee: 30, suggestedMax: 400, active: true }
    ]
  },
  { name: 'Spa & Wellness', icon: '💆', color: '#A78BFA', description: 'Massage, yoga, meditation trainers.', active: true,
    subcategories: [
      { name: 'Full Body Massage', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Head Massage', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Foot Massage', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Yoga Trainer', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Meditation Trainer', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true }
    ]
  },
  { name: 'Fitness Services', icon: '💪', color: '#F97316', description: 'Personal training, sports coaching.', active: true,
    subcategories: [
      { name: 'Gym Trainer', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Weight Loss Trainer', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
      { name: 'Strength Training', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Cricket Coach', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
      { name: 'Football Coach', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
      { name: 'Swimming Coach', minPrice: 699, platformFee: 140, suggestedMax: 3000, active: true }
    ]
  },
  { name: 'Tutoring & Education', icon: '📚', color: '#3B82F6', description: 'Home tutor, music, dance, language teachers.', active: true,
    subcategories: [
      { name: 'Home Tutor', minPrice: 299, platformFee: 60, suggestedMax: 1000, active: true },
      { name: 'Online Tutor', minPrice: 199, platformFee: 40, suggestedMax: 800, active: true },
      { name: 'Music Teacher', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'Dance Teacher', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'Language Teacher', minPrice: 349, platformFee: 70, suggestedMax: 1200, active: true }
    ]
  },
  { name: 'Event Services', icon: '📸', color: '#F43F5E', description: 'Photography, decoration, DJ, entertainment.', active: true,
    subcategories: [
      { name: 'Wedding Photography', minPrice: 4999, platformFee: 1000, suggestedMax: 20000, active: true },
      { name: 'Event Photography', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
      { name: 'Product Photography', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Birthday Decoration', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Wedding Decoration', minPrice: 4999, platformFee: 1000, suggestedMax: 25000, active: true },
      { name: 'DJ Service', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
      { name: 'Anchor Service', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'Live Singer', minPrice: 2499, platformFee: 500, suggestedMax: 10000, active: true }
    ]
  },
  { name: 'Vehicle Services', icon: '🚗', color: '#0D9488', description: 'Car wash, car repair, bike services.', active: true,
    subcategories: [
      { name: 'Car Wash', minPrice: 399, platformFee: 80, suggestedMax: 1000, active: true },
      { name: 'Car Repair', minPrice: 999, platformFee: 200, suggestedMax: 5000, active: true },
      { name: 'Car Detailing', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'Bike Wash', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
      { name: 'Bike Repair', minPrice: 299, platformFee: 60, suggestedMax: 1500, active: true }
    ]
  },
  { name: 'Digital Services', icon: '💻', color: '#7C3AED', description: 'IT support, web/app development, digital marketing.', active: true,
    subcategories: [
      { name: 'Computer Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'Laptop Repair', minPrice: 599, platformFee: 120, suggestedMax: 3000, active: true },
      { name: 'Printer Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
      { name: 'Website Development', minPrice: 4999, platformFee: 1000, suggestedMax: 25000, active: true },
      { name: 'Mobile App Development', minPrice: 9999, platformFee: 2000, suggestedMax: 50000, active: true },
      { name: 'SEO Service', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
      { name: 'Digital Marketing', minPrice: 3999, platformFee: 800, suggestedMax: 15000, active: true }
    ]
  },
  { name: 'Professional Services', icon: '👔', color: '#334155', description: 'Legal, CA, tax filing, insurance advisory.', active: true,
    subcategories: [
      { name: 'Legal Consultation', minPrice: 999, platformFee: 200, suggestedMax: 5000, active: true },
      { name: 'Document Verification', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
      { name: 'CA Service', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'Tax Filing', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'GST Filing', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
      { name: 'Insurance Advisor', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true }
    ]
  },
  { name: 'Domestic Help', icon: '👨‍👩‍👧', color: '#B45309', description: 'Maid, cook, babysitter, elder care, driver.', active: true,
    subcategories: [
      { name: 'Maid', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
      { name: 'Cook', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
      { name: 'Babysitter', minPrice: 349, platformFee: 70, suggestedMax: 1000, active: true },
      { name: 'Elder Care', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Personal Driver', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
      { name: 'Temporary Driver', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true }
    ]
  },
  { name: 'Pet Services', icon: '🐾', color: '#C2410C', description: 'Pet grooming, walking, training, vet visits.', active: true,
    subcategories: [
      { name: 'Pet Grooming', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Pet Walking', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
      { name: 'Pet Training', minPrice: 699, platformFee: 140, suggestedMax: 2500, active: true },
      { name: 'Vet Visit', minPrice: 799, platformFee: 160, suggestedMax: 3000, active: true },
      { name: 'Vaccination', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true }
    ]
  },
  { name: 'Healthcare at Home', icon: '🏥', color: '#DC2626', description: 'Nursing, physiotherapist, lab test, doctor visit.', active: true,
    subcategories: [
      { name: 'Home Nurse', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Caregiver', minPrice: 799, platformFee: 160, suggestedMax: 2500, active: true },
      { name: 'Physiotherapist', minPrice: 699, platformFee: 140, suggestedMax: 2500, active: true },
      { name: 'Lab Test', minPrice: 399, platformFee: 80, suggestedMax: 2000, active: true },
      { name: 'Doctor Visit', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true }
    ]
  },
  { name: 'Laundry Services', icon: '👕', color: '#2563EB', description: 'Wash & fold, dry cleaning, ironing.', active: true,
    subcategories: [
      { name: 'Wash & Fold', minPrice: 99, platformFee: 20, suggestedMax: 300, active: true },
      { name: 'Dry Cleaning', minPrice: 199, platformFee: 40, suggestedMax: 600, active: true },
      { name: 'Clothes Ironing', minPrice: 49, platformFee: 10, suggestedMax: 200, active: true }
    ]
  },
  { name: 'Real Estate Services', icon: '🏢', color: '#475569', description: 'Property inspection, tenant verification.', active: true,
    subcategories: [
      { name: 'Property Inspection', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
      { name: 'Property Management', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
      { name: 'Tenant Verification', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
      { name: 'Rental Assistance', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true }
    ]
  }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly').then(async () => {
  const result = await Category.create(categories);
  console.log('Categories seeded: ' + result.length);
  const totalSubs = result.reduce((sum, c) => sum + c.subcategories.length, 0);
  console.log('Total subcategories: ' + totalSubs);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
