/**
 * Kwickly Master Category Upsert Seeder
 * USAGE: node scripts/seed_master_categories.js
 *
 * - Creates category if name does not exist (case-insensitive check)
 * - Merges new subcategories into existing ones (never deletes existing data)
 * - Never duplicates subcategory names (case-insensitive dedup)
 * - Preserves existing imageUrl, minPrice, platformFee on existing docs
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../src/modules/category/category.model');

const MASTER = [
  {
    name: 'Home Cleaning & Housekeeping', icon: '🧹', color: '#10B981',
    description: 'Deep cleaning, sofa/carpet cleaning, water tank, sanitization, junk removal for homes and offices.',
    subs: [
      { name: 'Full Home Cleaning', minPrice: 999, platformFee: 200 },
      { name: 'Deep Home Cleaning', minPrice: 1499, platformFee: 300 },
      { name: 'Kitchen Cleaning', minPrice: 399, platformFee: 80 },
      { name: 'Bathroom Cleaning', minPrice: 299, platformFee: 60 },
      { name: 'Bedroom Cleaning', minPrice: 399, platformFee: 80 },
      { name: 'Living Room Cleaning', minPrice: 349, platformFee: 70 },
      { name: 'Balcony Cleaning', minPrice: 249, platformFee: 50 },
      { name: 'Floor Cleaning', minPrice: 299, platformFee: 60 },
      { name: 'Window Cleaning', minPrice: 299, platformFee: 60 },
      { name: 'Move-In Cleaning', minPrice: 1199, platformFee: 240 },
      { name: 'Move-Out Cleaning', minPrice: 1199, platformFee: 240 },
      { name: 'Post-Construction Cleaning', minPrice: 2499, platformFee: 500 },
      { name: 'Office Cleaning', minPrice: 1999, platformFee: 400 },
      { name: 'Commercial Cleaning', minPrice: 2499, platformFee: 500 },
      { name: 'Airbnb Cleaning', minPrice: 999, platformFee: 200 },
      { name: 'Sofa Cleaning', minPrice: 499, platformFee: 100 },
      { name: 'Carpet Cleaning', minPrice: 599, platformFee: 120 },
      { name: 'Mattress Cleaning', minPrice: 499, platformFee: 100 },
      { name: 'Curtain Cleaning', minPrice: 399, platformFee: 80 },
      { name: 'Upholstery Cleaning', minPrice: 499, platformFee: 100 },
      { name: 'Home Sanitization', minPrice: 799, platformFee: 160 },
      { name: 'Water Tank Cleaning', minPrice: 599, platformFee: 120 },
      { name: 'Chimney Cleaning', minPrice: 399, platformFee: 80 },
      { name: 'Kitchen Deep Cleaning', minPrice: 799, platformFee: 160 },
      { name: 'Bathroom Deep Cleaning', minPrice: 699, platformFee: 140 },
      { name: 'Tile & Grout Cleaning', minPrice: 499, platformFee: 100 },
      { name: 'Marble & Granite Cleaning', minPrice: 599, platformFee: 120 },
      { name: 'Junk Removal', minPrice: 499, platformFee: 100 },
      { name: 'E-Waste Collection', minPrice: 199, platformFee: 40 },
    ]
  },
  {
    name: 'Electrician Services', icon: '⚡', color: '#F59E0B',
    description: 'Wiring, fan/light installation, inverter, generator, earthing and electrical audits.',
    subs: [
      { name: 'Home Wiring', minPrice: 499, platformFee: 100 },
      { name: 'Switch & Socket Repair', minPrice: 99, platformFee: 20 },
      { name: 'Switchboard Repair', minPrice: 149, platformFee: 30 },
      { name: 'MCB Installation', minPrice: 249, platformFee: 50 },
      { name: 'DB Panel Installation', minPrice: 799, platformFee: 160 },
      { name: 'Fan Installation', minPrice: 299, platformFee: 60 },
      { name: 'Fan Repair', minPrice: 249, platformFee: 50 },
      { name: 'Ceiling Fan Installation', minPrice: 299, platformFee: 60 },
      { name: 'Exhaust Fan Installation', minPrice: 249, platformFee: 50 },
      { name: 'Light Installation', minPrice: 199, platformFee: 40 },
      { name: 'LED Installation', minPrice: 199, platformFee: 40 },
      { name: 'Chandelier Installation', minPrice: 499, platformFee: 100 },
      { name: 'Outdoor Lighting', minPrice: 599, platformFee: 120 },
      { name: 'Doorbell Installation', minPrice: 199, platformFee: 40 },
      { name: 'Inverter Installation', minPrice: 799, platformFee: 160 },
      { name: 'Inverter Repair', minPrice: 499, platformFee: 100 },
      { name: 'UPS Installation', minPrice: 599, platformFee: 120 },
      { name: 'Generator Installation', minPrice: 1499, platformFee: 300 },
      { name: 'Generator Repair', minPrice: 799, platformFee: 160 },
      { name: 'Earthing', minPrice: 699, platformFee: 140 },
      { name: 'Short Circuit Repair', minPrice: 399, platformFee: 80 },
      { name: 'Electrical Load Upgrade', minPrice: 999, platformFee: 200 },
      { name: 'Home Electrical Audit', minPrice: 699, platformFee: 140 },
      { name: 'Commercial Electrical Work', minPrice: 1999, platformFee: 400 },
    ]
  },
  {
    name: 'Plumbing Services', icon: '🔧', color: '#3B82F6',
    description: 'Tap/pipe repair, drain cleaning, toilet, water tank and pump services.',
    subs: [
      { name: 'Tap Repair', minPrice: 199, platformFee: 40 },
      { name: 'Tap Installation', minPrice: 249, platformFee: 50 },
      { name: 'Mixer Repair', minPrice: 249, platformFee: 50 },
      { name: 'Shower Repair', minPrice: 299, platformFee: 60 },
      { name: 'Toilet Repair', minPrice: 299, platformFee: 60 },
      { name: 'Toilet Installation', minPrice: 599, platformFee: 120 },
      { name: 'Flush Tank Repair', minPrice: 249, platformFee: 50 },
      { name: 'Wash Basin Installation', minPrice: 499, platformFee: 100 },
      { name: 'Sink Repair', minPrice: 249, platformFee: 50 },
      { name: 'Pipe Leakage Repair', minPrice: 249, platformFee: 50 },
      { name: 'Pipe Replacement', minPrice: 499, platformFee: 100 },
      { name: 'Drain Cleaning', minPrice: 399, platformFee: 80 },
      { name: 'Drain Blockage Removal', minPrice: 349, platformFee: 70 },
      { name: 'Sewer Cleaning', minPrice: 599, platformFee: 120 },
      { name: 'Water Tank Installation', minPrice: 999, platformFee: 200 },
      { name: 'Water Tank Repair', minPrice: 499, platformFee: 100 },
      { name: 'Water Pump Installation', minPrice: 999, platformFee: 200 },
      { name: 'Water Pump Repair', minPrice: 599, platformFee: 120 },
      { name: 'Borewell Pump', minPrice: 1499, platformFee: 300 },
      { name: 'Bathroom Plumbing', minPrice: 799, platformFee: 160 },
      { name: 'Commercial Plumbing', minPrice: 1999, platformFee: 400 },
    ]
  },
  {
    name: 'Carpentry & Furniture', icon: '🪚', color: '#D97706',
    description: 'Furniture repair/assembly, custom woodwork, door/window repair, modular furniture.',
    subs: [
      { name: 'Furniture Repair', minPrice: 499, platformFee: 100 },
      { name: 'Furniture Assembly', minPrice: 399, platformFee: 80 },
      { name: 'Custom Furniture', minPrice: 4999, platformFee: 1000 },
      { name: 'Bed Repair', minPrice: 499, platformFee: 100 },
      { name: 'Sofa Repair', minPrice: 699, platformFee: 140 },
      { name: 'Wardrobe Repair', minPrice: 599, platformFee: 120 },
      { name: 'Wardrobe Installation', minPrice: 799, platformFee: 160 },
      { name: 'Cabinet Installation', minPrice: 699, platformFee: 140 },
      { name: 'Shelf Installation', minPrice: 299, platformFee: 60 },
      { name: 'TV Unit Installation', minPrice: 599, platformFee: 120 },
      { name: 'Modular Furniture', minPrice: 4999, platformFee: 1000 },
      { name: 'Modular Kitchen Carpentry', minPrice: 9999, platformFee: 2000 },
      { name: 'Door Repair', minPrice: 399, platformFee: 80 },
      { name: 'Door Installation', minPrice: 699, platformFee: 140 },
      { name: 'Window Repair', minPrice: 399, platformFee: 80 },
      { name: 'Curtain Rod Installation', minPrice: 199, platformFee: 40 },
      { name: 'Furniture Polishing', minPrice: 799, platformFee: 160 },
      { name: 'Wood Restoration', minPrice: 699, platformFee: 140 },
    ]
  },
  {
    name: 'Painting & Waterproofing', icon: '🎨', color: '#8B5CF6',
    description: 'Interior/exterior painting, texture, wallpaper, POP work, false ceiling, waterproofing.',
    subs: [
      { name: 'Interior Painting', minPrice: 1999, platformFee: 400 },
      { name: 'Exterior Painting', minPrice: 4999, platformFee: 1000 },
      { name: 'Full Home Painting', minPrice: 9999, platformFee: 2000 },
      { name: 'Room Painting', minPrice: 1999, platformFee: 400 },
      { name: 'Office Painting', minPrice: 3999, platformFee: 800 },
      { name: 'Texture Painting', minPrice: 3999, platformFee: 800 },
      { name: 'Designer Painting', minPrice: 4999, platformFee: 1000 },
      { name: 'Waterproof Painting', minPrice: 2999, platformFee: 600 },
      { name: 'Wood Painting', minPrice: 999, platformFee: 200 },
      { name: 'Wallpaper Installation', minPrice: 1999, platformFee: 400 },
      { name: 'Wall Panels', minPrice: 2499, platformFee: 500 },
      { name: 'POP Work', minPrice: 1499, platformFee: 300 },
      { name: 'False Ceiling', minPrice: 3999, platformFee: 800 },
      { name: 'Wall Crack Repair', minPrice: 599, platformFee: 120 },
      { name: 'Waterproofing', minPrice: 2999, platformFee: 600 },
      { name: 'Terrace Waterproofing', minPrice: 3999, platformFee: 800 },
      { name: 'Bathroom Waterproofing', minPrice: 1999, platformFee: 400 },
    ]
  },
  {
    name: 'AC & Appliances', icon: '❄️', color: '#06B6D4',
    description: 'AC, refrigerator, washing machine, TV, water purifier, geyser and kitchen appliance services.',
    subs: [
      { name: 'AC Installation', minPrice: 999, platformFee: 200 },
      { name: 'AC Uninstallation', minPrice: 499, platformFee: 100 },
      { name: 'AC General Service', minPrice: 499, platformFee: 100 },
      { name: 'AC Deep Cleaning', minPrice: 599, platformFee: 120 },
      { name: 'AC Repair', minPrice: 599, platformFee: 120 },
      { name: 'AC Gas Refill', minPrice: 1200, platformFee: 250 },
      { name: 'AC PCB Repair', minPrice: 1499, platformFee: 300 },
      { name: 'AC Compressor Repair', minPrice: 1999, platformFee: 400 },
      { name: 'AC AMC', minPrice: 1499, platformFee: 300 },
      { name: 'Refrigerator Repair', minPrice: 499, platformFee: 100 },
      { name: 'Refrigerator Service', minPrice: 399, platformFee: 80 },
      { name: 'Freezer Repair', minPrice: 599, platformFee: 120 },
      { name: 'Refrigerator AMC', minPrice: 999, platformFee: 200 },
      { name: 'Washing Machine Repair', minPrice: 499, platformFee: 100 },
      { name: 'Washing Machine Service', minPrice: 399, platformFee: 80 },
      { name: 'Washing Machine Installation', minPrice: 299, platformFee: 60 },
      { name: 'Washing Machine AMC', minPrice: 799, platformFee: 160 },
      { name: 'Microwave Repair', minPrice: 399, platformFee: 80 },
      { name: 'Gas Stove Repair', minPrice: 299, platformFee: 60 },
      { name: 'Chimney Repair', minPrice: 499, platformFee: 100 },
      { name: 'Dishwasher Repair', minPrice: 599, platformFee: 120 },
      { name: 'LED TV Repair', minPrice: 499, platformFee: 100 },
      { name: 'Smart TV Repair', minPrice: 599, platformFee: 120 },
      { name: 'TV Wall Mounting', minPrice: 399, platformFee: 80 },
      { name: 'Home Theatre Installation', minPrice: 1499, platformFee: 300 },
      { name: 'RO Installation', minPrice: 699, platformFee: 140 },
      { name: 'RO Repair', minPrice: 499, platformFee: 100 },
      { name: 'RO Service', minPrice: 399, platformFee: 80 },
      { name: 'Water Purifier AMC', minPrice: 799, platformFee: 160 },
      { name: 'Geyser Repair', minPrice: 499, platformFee: 100 },
      { name: 'Geyser Installation', minPrice: 399, platformFee: 80 },
      { name: 'Geyser AMC', minPrice: 699, platformFee: 140 },
    ]
  },
  {
    name: 'Pest Control', icon: '🐛', color: '#EF4444',
    description: 'Cockroach, termite, bed bug, mosquito, rodent, pigeon control and commercial pest services.',
    subs: [
      { name: 'General Pest Control', minPrice: 399, platformFee: 80 },
      { name: 'Cockroach Control', minPrice: 399, platformFee: 80 },
      { name: 'Termite Control', minPrice: 1999, platformFee: 400 },
      { name: 'Bed Bug Control', minPrice: 999, platformFee: 200 },
      { name: 'Mosquito Control', minPrice: 599, platformFee: 120 },
      { name: 'Rat Control', minPrice: 499, platformFee: 100 },
      { name: 'Rodent Control', minPrice: 499, platformFee: 100 },
      { name: 'Ant Control', minPrice: 299, platformFee: 60 },
      { name: 'Wood Borer Control', minPrice: 999, platformFee: 200 },
      { name: 'Bee & Wasp Control', minPrice: 699, platformFee: 140 },
      { name: 'Pigeon Control', minPrice: 799, platformFee: 160 },
      { name: 'Pre-Construction Anti-Termite', minPrice: 2999, platformFee: 600 },
      { name: 'Commercial Pest Control', minPrice: 1499, platformFee: 300 },
      { name: 'Pest Control AMC', minPrice: 2999, platformFee: 600 },
    ]
  },
  {
    name: 'Construction & Renovation', icon: '🏗️', color: '#6366F1',
    description: 'Civil work, tiles, flooring, modular kitchen, home renovation, welding, glass and UPVC work.',
    subs: [
      { name: 'Tiles Installation', minPrice: 1999, platformFee: 400 },
      { name: 'Marble Flooring', minPrice: 3999, platformFee: 800 },
      { name: 'Wooden Flooring', minPrice: 4999, platformFee: 1000 },
      { name: 'Vinyl Flooring', minPrice: 2999, platformFee: 600 },
      { name: 'Mason Work', minPrice: 1499, platformFee: 300 },
      { name: 'Brick Work', minPrice: 1999, platformFee: 400 },
      { name: 'Plaster Work', minPrice: 1499, platformFee: 300 },
      { name: 'Bathroom Renovation', minPrice: 9999, platformFee: 2000 },
      { name: 'Kitchen Renovation', minPrice: 14999, platformFee: 3000 },
      { name: 'Full Home Renovation', minPrice: 49999, platformFee: 10000 },
      { name: 'Home Interior Design', minPrice: 14999, platformFee: 3000 },
      { name: 'Modular Kitchen', minPrice: 19999, platformFee: 4000 },
      { name: 'Modular Wardrobe', minPrice: 9999, platformFee: 2000 },
      { name: 'Demolition Work', minPrice: 4999, platformFee: 1000 },
      { name: 'Building Contractor', minPrice: 49999, platformFee: 10000 },
      { name: 'Gate Fabrication', minPrice: 4999, platformFee: 1000 },
      { name: 'Grill Fabrication', minPrice: 2999, platformFee: 600 },
      { name: 'MS/SS Fabrication', minPrice: 3999, platformFee: 800 },
      { name: 'Glass Partition', minPrice: 4999, platformFee: 1000 },
      { name: 'UPVC Window', minPrice: 3999, platformFee: 800 },
      { name: 'Aluminium Door', minPrice: 4999, platformFee: 1000 },
      { name: 'Mosquito Net', minPrice: 799, platformFee: 160 },
    ]
  },
  {
    name: 'Security & Smart Home', icon: '🔒', color: '#1E293B',
    description: 'CCTV, access control, smart locks, home automation, burglar alarm and locksmith services.',
    subs: [
      { name: 'CCTV Installation', minPrice: 2999, platformFee: 600 },
      { name: 'CCTV Repair', minPrice: 499, platformFee: 100 },
      { name: 'CCTV AMC', minPrice: 1499, platformFee: 300 },
      { name: 'IP Camera', minPrice: 1999, platformFee: 400 },
      { name: 'Wi-Fi Camera', minPrice: 1499, platformFee: 300 },
      { name: 'DVR/NVR Installation', minPrice: 1999, platformFee: 400 },
      { name: 'Video Doorbell', minPrice: 999, platformFee: 200 },
      { name: 'Smart Doorbell', minPrice: 1199, platformFee: 240 },
      { name: 'Intercom', minPrice: 1499, platformFee: 300 },
      { name: 'Access Control', minPrice: 3999, platformFee: 800 },
      { name: 'Biometric System', minPrice: 2999, platformFee: 600 },
      { name: 'Burglar Alarm', minPrice: 1999, platformFee: 400 },
      { name: 'Smart Lock', minPrice: 1499, platformFee: 300 },
      { name: 'Home Automation', minPrice: 4999, platformFee: 1000 },
      { name: 'Smart Lighting', minPrice: 999, platformFee: 200 },
      { name: 'Smart Switch', minPrice: 799, platformFee: 160 },
      { name: 'Locksmith', minPrice: 299, platformFee: 60 },
      { name: 'Lock Repair', minPrice: 249, platformFee: 50 },
      { name: 'Key Duplication', minPrice: 99, platformFee: 20 },
      { name: 'Safe Opening', minPrice: 699, platformFee: 140 },
      { name: 'Fire Alarm Installation', minPrice: 2499, platformFee: 500 },
    ]
  },
  {
    name: 'Solar & EV Services', icon: '☀️', color: '#F59E0B',
    description: 'Solar panel installation/repair/AMC, EV charger installation and EV battery services.',
    subs: [
      { name: 'Rooftop Solar Installation', minPrice: 9999, platformFee: 2000 },
      { name: 'Solar Panel Repair', minPrice: 1499, platformFee: 300 },
      { name: 'Solar Panel Cleaning', minPrice: 699, platformFee: 140 },
      { name: 'Solar Inverter', minPrice: 2999, platformFee: 600 },
      { name: 'Solar Battery', minPrice: 3999, platformFee: 800 },
      { name: 'Solar Water Heater', minPrice: 4999, platformFee: 1000 },
      { name: 'Solar AMC', minPrice: 1999, platformFee: 400 },
      { name: 'Solar Inspection', minPrice: 699, platformFee: 140 },
      { name: 'Commercial Solar', minPrice: 49999, platformFee: 10000 },
      { name: 'Solar Net-Metering Assistance', minPrice: 999, platformFee: 200 },
      { name: 'EV Charger Installation', minPrice: 4999, platformFee: 1000 },
      { name: 'Home EV Charger', minPrice: 3999, platformFee: 800 },
      { name: 'EV Charger Repair', minPrice: 999, platformFee: 200 },
      { name: 'EV Battery Diagnostics', minPrice: 699, platformFee: 140 },
      { name: 'EV Battery Replacement', minPrice: 4999, platformFee: 1000 },
      { name: 'EV Roadside Assistance', minPrice: 499, platformFee: 100 },
    ]
  },
  {
    name: 'Automobile Services', icon: '🚗', color: '#0D9488',
    description: 'Car/bike service, repair, detailing, denting/painting, tyre, battery, diagnostics and inspection.',
    subs: [
      { name: 'Car General Service', minPrice: 999, platformFee: 200 },
      { name: 'Car Engine Repair', minPrice: 2999, platformFee: 600 },
      { name: 'Car Brake Repair', minPrice: 799, platformFee: 160 },
      { name: 'Car AC Repair', minPrice: 999, platformFee: 200 },
      { name: 'Car Electrical Repair', minPrice: 999, platformFee: 200 },
      { name: 'Car Diagnostic', minPrice: 499, platformFee: 100 },
      { name: 'Car Washing', minPrice: 399, platformFee: 80 },
      { name: 'Car Detailing', minPrice: 1499, platformFee: 300 },
      { name: 'Car Polishing', minPrice: 999, platformFee: 200 },
      { name: 'Ceramic Coating', minPrice: 3999, platformFee: 800 },
      { name: 'Dent Repair', minPrice: 999, platformFee: 200 },
      { name: 'Car Painting', minPrice: 2999, platformFee: 600 },
      { name: 'Windshield Replacement', minPrice: 1999, platformFee: 400 },
      { name: 'Dashcam Installation', minPrice: 799, platformFee: 160 },
      { name: 'GPS Installation', minPrice: 699, platformFee: 140 },
      { name: 'Car Towing', minPrice: 499, platformFee: 100 },
      { name: 'Used Car Inspection', minPrice: 999, platformFee: 200 },
      { name: 'Car AMC', minPrice: 4999, platformFee: 1000 },
      { name: 'Bike General Service', minPrice: 499, platformFee: 100 },
      { name: 'Bike Engine Repair', minPrice: 999, platformFee: 200 },
      { name: 'Bike Washing', minPrice: 199, platformFee: 40 },
      { name: 'Bike Detailing', minPrice: 799, platformFee: 160 },
      { name: 'Bike Towing', minPrice: 299, platformFee: 60 },
      { name: 'Tyre Replacement', minPrice: 299, platformFee: 60 },
      { name: 'Puncture Repair', minPrice: 99, platformFee: 20 },
      { name: 'Wheel Alignment', minPrice: 399, platformFee: 80 },
      { name: 'Car Battery Replacement', minPrice: 699, platformFee: 140 },
      { name: 'Bike Battery Replacement', minPrice: 299, platformFee: 60 },
      { name: 'Roadside Assistance', minPrice: 299, platformFee: 60 },
    ]
  },
  {
    name: 'Transport & Drivers', icon: '🚖', color: '#0EA5E9',
    description: 'On-demand driver, full/part-time driver, taxi, car rental, outstation, driving school.',
    subs: [
      { name: 'Driver on Demand', minPrice: 399, platformFee: 80 },
      { name: 'Full-Time Driver', minPrice: 8999, platformFee: 1800 },
      { name: 'Part-Time Driver', minPrice: 3999, platformFee: 800 },
      { name: 'Outstation Driver', minPrice: 999, platformFee: 200 },
      { name: 'Airport Driver', minPrice: 599, platformFee: 120 },
      { name: 'Wedding Driver', minPrice: 1499, platformFee: 300 },
      { name: 'Corporate Driver', minPrice: 599, platformFee: 120 },
      { name: 'Senior Citizen Driver', minPrice: 499, platformFee: 100 },
      { name: 'Driving School', minPrice: 2499, platformFee: 500 },
      { name: 'Car Driving Training', minPrice: 1999, platformFee: 400 },
      { name: 'Bike Driving Training', minPrice: 999, platformFee: 200 },
      { name: 'RTO & Licence Assistance', minPrice: 499, platformFee: 100 },
      { name: 'Local Taxi', minPrice: 199, platformFee: 40 },
      { name: 'Airport Taxi', minPrice: 499, platformFee: 100 },
      { name: 'Outstation Taxi', minPrice: 1999, platformFee: 400 },
      { name: 'Luxury Car', minPrice: 2999, platformFee: 600 },
      { name: 'Self-Drive Car Rental', minPrice: 999, platformFee: 200 },
      { name: 'Tempo Traveller', minPrice: 3999, platformFee: 800 },
      { name: 'Bus Rental', minPrice: 9999, platformFee: 2000 },
      { name: 'Goods Vehicle Rental', minPrice: 1499, platformFee: 300 },
    ]
  },
  {
    name: 'Packers, Movers & Storage', icon: '📦', color: '#64748B',
    description: 'Local/intercity shifting, packing, loading, bike/car transport and household/office storage.',
    subs: [
      { name: 'Local Shifting', minPrice: 2999, platformFee: 600 },
      { name: 'Home Shifting', minPrice: 4999, platformFee: 1000 },
      { name: 'Office Shifting', minPrice: 5999, platformFee: 1200 },
      { name: 'Intercity Shifting', minPrice: 7999, platformFee: 1600 },
      { name: 'Interstate Shifting', minPrice: 14999, platformFee: 3000 },
      { name: 'International Moving', minPrice: 29999, platformFee: 6000 },
      { name: 'Packing Service', minPrice: 999, platformFee: 200 },
      { name: 'Loading & Unloading', minPrice: 599, platformFee: 120 },
      { name: 'Bike Transportation', minPrice: 1999, platformFee: 400 },
      { name: 'Car Transportation', minPrice: 4999, platformFee: 1000 },
      { name: 'Household Storage', minPrice: 1499, platformFee: 300 },
      { name: 'Warehouse Storage', minPrice: 2999, platformFee: 600 },
    ]
  },
  {
    name: 'Beauty & Grooming', icon: '💇', color: '#EC4899',
    description: 'At-home salon for women and men including haircut, facial, waxing, makeup, mehendi and bridal.',
    subs: [
      { name: 'Women Haircut', minPrice: 299, platformFee: 60 },
      { name: 'Hair Styling', minPrice: 299, platformFee: 60 },
      { name: 'Hair Coloring', minPrice: 799, platformFee: 160 },
      { name: 'Hair Spa', minPrice: 499, platformFee: 100 },
      { name: 'Hair Smoothening', minPrice: 1999, platformFee: 400 },
      { name: 'Keratin Treatment', minPrice: 2499, platformFee: 500 },
      { name: 'Facial', minPrice: 399, platformFee: 80 },
      { name: 'Cleanup', minPrice: 299, platformFee: 60 },
      { name: 'Bleach', minPrice: 249, platformFee: 50 },
      { name: 'Threading', minPrice: 99, platformFee: 20 },
      { name: 'Waxing', minPrice: 399, platformFee: 80 },
      { name: 'Manicure', minPrice: 299, platformFee: 60 },
      { name: 'Pedicure', minPrice: 349, platformFee: 70 },
      { name: 'Nail Art', minPrice: 499, platformFee: 100 },
      { name: 'Nail Extensions', minPrice: 799, platformFee: 160 },
      { name: 'Bridal Makeup', minPrice: 3999, platformFee: 800 },
      { name: 'Party Makeup', minPrice: 1499, platformFee: 300 },
      { name: 'Engagement Makeup', minPrice: 2499, platformFee: 500 },
      { name: 'Saree Draping', minPrice: 299, platformFee: 60 },
      { name: 'Eyelash Extensions', minPrice: 999, platformFee: 200 },
      { name: 'Men Haircut', minPrice: 199, platformFee: 40 },
      { name: 'Beard Trim', minPrice: 149, platformFee: 30 },
      { name: 'Beard Styling', minPrice: 149, platformFee: 30 },
      { name: 'Shaving', minPrice: 99, platformFee: 20 },
      { name: 'Groom Makeup', minPrice: 1499, platformFee: 300 },
      { name: 'Bridal Mehendi', minPrice: 1499, platformFee: 300 },
      { name: 'Arabic Mehendi', minPrice: 799, platformFee: 160 },
      { name: 'Party Mehendi', minPrice: 599, platformFee: 120 },
    ]
  },
  {
    name: 'Health, Fitness & Wellness', icon: '💆', color: '#A78BFA',
    description: 'Home massage, yoga, personal training, doctor home visit, physiotherapy and lab tests.',
    subs: [
      { name: 'Full Body Massage', minPrice: 999, platformFee: 200 },
      { name: 'Swedish Massage', minPrice: 1199, platformFee: 240 },
      { name: 'Deep Tissue Massage', minPrice: 1299, platformFee: 260 },
      { name: 'Ayurvedic Massage', minPrice: 999, platformFee: 200 },
      { name: 'Head Massage', minPrice: 299, platformFee: 60 },
      { name: 'Foot Massage', minPrice: 299, platformFee: 60 },
      { name: 'Couple Massage', minPrice: 1999, platformFee: 400 },
      { name: 'Spa Therapy', minPrice: 1499, platformFee: 300 },
      { name: 'Yoga Trainer', minPrice: 499, platformFee: 100 },
      { name: 'Meditation', minPrice: 299, platformFee: 60 },
      { name: 'Personal Trainer', minPrice: 499, platformFee: 100 },
      { name: 'Weight Loss Training', minPrice: 599, platformFee: 120 },
      { name: 'Zumba', minPrice: 399, platformFee: 80 },
      { name: 'Pilates', minPrice: 499, platformFee: 100 },
      { name: 'Nutritionist', minPrice: 699, platformFee: 140 },
      { name: 'Doctor Home Visit', minPrice: 999, platformFee: 200 },
      { name: 'Home Nursing', minPrice: 999, platformFee: 200 },
      { name: 'Physiotherapy', minPrice: 699, platformFee: 140 },
      { name: 'Blood Sample Collection', minPrice: 299, platformFee: 60 },
      { name: 'Lab Test at Home', minPrice: 399, platformFee: 80 },
      { name: 'Ambulance', minPrice: 499, platformFee: 100 },
    ]
  },
  {
    name: 'Baby, Elder & Domestic Care', icon: '👨‍👩‍👧', color: '#B45309',
    description: 'Babysitter, nanny, elderly care, maid, cook, home helper and patient attendant.',
    subs: [
      { name: 'Babysitter', minPrice: 349, platformFee: 70 },
      { name: 'Nanny', minPrice: 699, platformFee: 140 },
      { name: 'Newborn Care', minPrice: 999, platformFee: 200 },
      { name: 'Full-Time Nanny', minPrice: 8999, platformFee: 1800 },
      { name: 'After-School Care', minPrice: 499, platformFee: 100 },
      { name: 'Special Needs Childcare', minPrice: 999, platformFee: 200 },
      { name: 'Elder Care', minPrice: 499, platformFee: 100 },
      { name: 'Senior Companion', minPrice: 399, platformFee: 80 },
      { name: 'Home Attendant', minPrice: 699, platformFee: 140 },
      { name: 'Patient Care', minPrice: 799, platformFee: 160 },
      { name: 'Post-Surgery Care', minPrice: 999, platformFee: 200 },
      { name: 'Full-Time Maid', minPrice: 6999, platformFee: 1400 },
      { name: 'Part-Time Maid', minPrice: 2999, platformFee: 600 },
      { name: 'Cooking Maid', minPrice: 3499, platformFee: 700 },
      { name: 'Cleaning Maid', minPrice: 2499, platformFee: 500 },
      { name: 'Kitchen Helper', minPrice: 1999, platformFee: 400 },
      { name: 'Home Cook (Full-Time)', minPrice: 8999, platformFee: 1800 },
      { name: 'Home Cook (Part-Time)', minPrice: 3999, platformFee: 800 },
      { name: 'Personal Driver', minPrice: 599, platformFee: 120 },
      { name: 'General Handyman', minPrice: 299, platformFee: 60 },
    ]
  },
  {
    name: 'Pet Care', icon: '🐾', color: '#C2410C',
    description: 'Pet grooming, walking, boarding, training and veterinary home visits.',
    subs: [
      { name: 'Pet Grooming', minPrice: 499, platformFee: 100 },
      { name: 'Dog Grooming', minPrice: 499, platformFee: 100 },
      { name: 'Cat Grooming', minPrice: 399, platformFee: 80 },
      { name: 'Pet Bath', minPrice: 299, platformFee: 60 },
      { name: 'Pet Nail Trimming', minPrice: 149, platformFee: 30 },
      { name: 'Pet Walking', minPrice: 199, platformFee: 40 },
      { name: 'Pet Sitting', minPrice: 299, platformFee: 60 },
      { name: 'Pet Boarding', minPrice: 499, platformFee: 100 },
      { name: 'Pet Daycare', minPrice: 399, platformFee: 80 },
      { name: 'Dog Training', minPrice: 699, platformFee: 140 },
      { name: 'Pet Taxi', minPrice: 299, platformFee: 60 },
      { name: 'Veterinary Home Visit', minPrice: 799, platformFee: 160 },
      { name: 'Pet Photography', minPrice: 999, platformFee: 200 },
    ]
  },
  {
    name: 'Food, Catering & Laundry', icon: '🍽️', color: '#F97316',
    description: 'Home catering, party/wedding catering, tiffin service, laundry, dry cleaning.',
    subs: [
      { name: 'Home Catering', minPrice: 1499, platformFee: 300 },
      { name: 'Party Catering', minPrice: 2999, platformFee: 600 },
      { name: 'Wedding Catering', minPrice: 9999, platformFee: 2000 },
      { name: 'Corporate Catering', minPrice: 2499, platformFee: 500 },
      { name: 'Birthday Catering', minPrice: 1999, platformFee: 400 },
      { name: 'Tiffin Service', minPrice: 99, platformFee: 20 },
      { name: 'Meal Subscription', minPrice: 999, platformFee: 200 },
      { name: 'Live Food Counter', minPrice: 3999, platformFee: 800 },
      { name: 'Laundry', minPrice: 99, platformFee: 20 },
      { name: 'Wash & Fold', minPrice: 99, platformFee: 20 },
      { name: 'Dry Cleaning', minPrice: 199, platformFee: 40 },
      { name: 'Steam Ironing', minPrice: 49, platformFee: 10 },
      { name: 'Shoe Cleaning', minPrice: 199, platformFee: 40 },
      { name: 'Carpet Dry Cleaning', minPrice: 599, platformFee: 120 },
      { name: 'Blanket Cleaning', minPrice: 299, platformFee: 60 },
      { name: 'Saree Dry Cleaning', minPrice: 249, platformFee: 50 },
      { name: 'Pickup & Delivery Laundry', minPrice: 49, platformFee: 10 },
    ]
  },
  {
    name: 'Gardening & Landscaping', icon: '🌿', color: '#059669',
    description: 'Garden maintenance, lawn care, tree trimming, terrace gardening and drip irrigation.',
    subs: [
      { name: 'Garden Maintenance', minPrice: 299, platformFee: 60 },
      { name: 'Lawn Mowing', minPrice: 299, platformFee: 60 },
      { name: 'Lawn Installation', minPrice: 1499, platformFee: 300 },
      { name: 'Plant Maintenance', minPrice: 199, platformFee: 40 },
      { name: 'Plant Pruning', minPrice: 249, platformFee: 50 },
      { name: 'Terrace Gardening', minPrice: 1999, platformFee: 400 },
      { name: 'Balcony Gardening', minPrice: 999, platformFee: 200 },
      { name: 'Vertical Garden', minPrice: 3999, platformFee: 800 },
      { name: 'Landscape Design', minPrice: 4999, platformFee: 1000 },
      { name: 'Tree Trimming', minPrice: 499, platformFee: 100 },
      { name: 'Tree Removal', minPrice: 999, platformFee: 200 },
      { name: 'Drip Irrigation', minPrice: 1999, platformFee: 400 },
      { name: 'Garden Cleaning', minPrice: 349, platformFee: 70 },
    ]
  },
  {
    name: 'Education & Training', icon: '📚', color: '#3B82F6',
    description: 'Home tutors, competitive exam coaching, skill classes, music, dance and language courses.',
    subs: [
      { name: 'Home Tutor', minPrice: 299, platformFee: 60 },
      { name: 'Online Tutor', minPrice: 199, platformFee: 40 },
      { name: 'School Tuition', minPrice: 299, platformFee: 60 },
      { name: 'College Tuition', minPrice: 399, platformFee: 80 },
      { name: 'Mathematics', minPrice: 299, platformFee: 60 },
      { name: 'Science Tuition', minPrice: 299, platformFee: 60 },
      { name: 'English Tuition', minPrice: 249, platformFee: 50 },
      { name: 'Spoken English', minPrice: 299, platformFee: 60 },
      { name: 'Coding & Programming', minPrice: 499, platformFee: 100 },
      { name: 'Special Education', minPrice: 499, platformFee: 100 },
      { name: 'Career Counselling', minPrice: 699, platformFee: 140 },
      { name: 'UPSC / GPSC Coaching', minPrice: 1999, platformFee: 400 },
      { name: 'Banking Coaching', minPrice: 1499, platformFee: 300 },
      { name: 'NEET Coaching', minPrice: 1999, platformFee: 400 },
      { name: 'JEE Coaching', minPrice: 1999, platformFee: 400 },
      { name: 'CA / CS Coaching', minPrice: 2499, platformFee: 500 },
      { name: 'IELTS / TOEFL', minPrice: 1499, platformFee: 300 },
      { name: 'Music Teacher', minPrice: 399, platformFee: 80 },
      { name: 'Dance Teacher', minPrice: 399, platformFee: 80 },
      { name: 'Photography Class', minPrice: 499, platformFee: 100 },
      { name: 'Cooking Classes', minPrice: 349, platformFee: 70 },
      { name: 'Foreign Languages', minPrice: 399, platformFee: 80 },
      { name: 'Public Speaking', minPrice: 499, platformFee: 100 },
    ]
  },
  {
    name: 'Events & Wedding', icon: '🎉', color: '#F43F5E',
    description: 'Photography, decoration, DJ, event planning, wedding planning, entertainment and catering.',
    subs: [
      { name: 'Wedding Photography', minPrice: 4999, platformFee: 1000 },
      { name: 'Pre-Wedding Shoot', minPrice: 3999, platformFee: 800 },
      { name: 'Engagement Photography', minPrice: 2999, platformFee: 600 },
      { name: 'Birthday Photography', minPrice: 1499, platformFee: 300 },
      { name: 'Baby Photography', minPrice: 1499, platformFee: 300 },
      { name: 'Product Photography', minPrice: 999, platformFee: 200 },
      { name: 'Event Photography', minPrice: 1999, platformFee: 400 },
      { name: 'Drone Photography', minPrice: 2999, platformFee: 600 },
      { name: 'Wedding Videography', minPrice: 6999, platformFee: 1400 },
      { name: 'Birthday Decoration', minPrice: 999, platformFee: 200 },
      { name: 'Wedding Decoration', minPrice: 4999, platformFee: 1000 },
      { name: 'Balloon Decoration', minPrice: 599, platformFee: 120 },
      { name: 'Flower Decoration', minPrice: 1499, platformFee: 300 },
      { name: 'Stage Decoration', minPrice: 2999, platformFee: 600 },
      { name: 'DJ Service', minPrice: 1999, platformFee: 400 },
      { name: 'Live Singer', minPrice: 2499, platformFee: 500 },
      { name: 'Live Band', minPrice: 4999, platformFee: 1000 },
      { name: 'Anchor / Emcee', minPrice: 1499, platformFee: 300 },
      { name: 'Wedding Planning', minPrice: 9999, platformFee: 2000 },
      { name: 'Event Management', minPrice: 4999, platformFee: 1000 },
      { name: 'Choreographer', minPrice: 1999, platformFee: 400 },
      { name: 'Dhol Player', minPrice: 1499, platformFee: 300 },
      { name: 'Magician', minPrice: 1999, platformFee: 400 },
      { name: 'Event Security', minPrice: 599, platformFee: 120 },
    ]
  },
  {
    name: 'Astrology & Religious Services', icon: '🕉️', color: '#7C3AED',
    description: 'Astrology, Vastu, pandit booking, pooja, havan, namkaran, funeral and last-rites.',
    subs: [
      { name: 'Astrology Consultation', minPrice: 499, platformFee: 100 },
      { name: 'Horoscope Reading', minPrice: 299, platformFee: 60 },
      { name: 'Kundli Reading', minPrice: 399, platformFee: 80 },
      { name: 'Kundli Matching', minPrice: 499, platformFee: 100 },
      { name: 'Numerology', minPrice: 299, platformFee: 60 },
      { name: 'Tarot Reading', minPrice: 299, platformFee: 60 },
      { name: 'Vastu Consultation', minPrice: 799, platformFee: 160 },
      { name: 'Home Vastu', minPrice: 999, platformFee: 200 },
      { name: 'Pandit Booking', minPrice: 799, platformFee: 160 },
      { name: 'Griha Pravesh Pooja', minPrice: 1499, platformFee: 300 },
      { name: 'Satyanarayan Pooja', minPrice: 999, platformFee: 200 },
      { name: 'Ganesh Pooja', minPrice: 799, platformFee: 160 },
      { name: 'Navgraha Pooja', minPrice: 1199, platformFee: 240 },
      { name: 'Havan', minPrice: 1499, platformFee: 300 },
      { name: 'Yagya', minPrice: 2999, platformFee: 600 },
      { name: 'Wedding Pooja', minPrice: 1999, platformFee: 400 },
      { name: 'Mundan Ceremony', minPrice: 799, platformFee: 160 },
      { name: 'Naamkaran Ceremony', minPrice: 699, platformFee: 140 },
      { name: 'Funeral Pandit', minPrice: 1499, platformFee: 300 },
      { name: 'Antim Sanskar', minPrice: 1999, platformFee: 400 },
      { name: 'Shraddh Pooja', minPrice: 1499, platformFee: 300 },
    ]
  },
  {
    name: 'IT, Digital & Creative', icon: '💻', color: '#7C3AED',
    description: 'Laptop/mobile repair, website development, app dev, digital marketing, SEO and creative design.',
    subs: [
      { name: 'Laptop Repair', minPrice: 599, platformFee: 120 },
      { name: 'Desktop Repair', minPrice: 499, platformFee: 100 },
      { name: 'Mobile Screen Replacement', minPrice: 699, platformFee: 140 },
      { name: 'Mobile Repair', minPrice: 399, platformFee: 80 },
      { name: 'Virus Removal', minPrice: 399, platformFee: 80 },
      { name: 'Data Recovery', minPrice: 999, platformFee: 200 },
      { name: 'OS Installation', minPrice: 299, platformFee: 60 },
      { name: 'Printer Repair', minPrice: 399, platformFee: 80 },
      { name: 'Wi-Fi & Network Setup', minPrice: 499, platformFee: 100 },
      { name: 'IT AMC', minPrice: 1499, platformFee: 300 },
      { name: 'Website Development', minPrice: 4999, platformFee: 1000 },
      { name: 'E-Commerce Website', minPrice: 7999, platformFee: 1600 },
      { name: 'WordPress Website', minPrice: 2999, platformFee: 600 },
      { name: 'Android App Development', minPrice: 9999, platformFee: 2000 },
      { name: 'iOS App Development', minPrice: 12999, platformFee: 2600 },
      { name: 'UI/UX Design', minPrice: 4999, platformFee: 1000 },
      { name: 'Digital Marketing', minPrice: 3999, platformFee: 800 },
      { name: 'Social Media Marketing', minPrice: 2999, platformFee: 600 },
      { name: 'Google Ads', minPrice: 1999, platformFee: 400 },
      { name: 'SEO', minPrice: 2999, platformFee: 600 },
      { name: 'Content Writing', minPrice: 999, platformFee: 200 },
      { name: 'Graphic Design', minPrice: 999, platformFee: 200 },
      { name: 'Logo Design', minPrice: 1499, platformFee: 300 },
      { name: 'Video Editing', minPrice: 999, platformFee: 200 },
      { name: 'Motion Graphics', minPrice: 1999, platformFee: 400 },
    ]
  },
  {
    name: 'Professional & Legal', icon: '👔', color: '#334155',
    description: 'CA, tax filing, GST, legal consultation, company registration and insurance advisory.',
    subs: [
      { name: 'Chartered Accountant', minPrice: 1499, platformFee: 300 },
      { name: 'Bookkeeping', minPrice: 999, platformFee: 200 },
      { name: 'GST Filing', minPrice: 1499, platformFee: 300 },
      { name: 'ITR Filing', minPrice: 999, platformFee: 200 },
      { name: 'Tax Consultant', minPrice: 999, platformFee: 200 },
      { name: 'Audit Services', minPrice: 2999, platformFee: 600 },
      { name: 'Company Registration', minPrice: 3999, platformFee: 800 },
      { name: 'Trademark Registration', minPrice: 2999, platformFee: 600 },
      { name: 'Business Consultant', minPrice: 1499, platformFee: 300 },
      { name: 'Payroll Services', minPrice: 1999, platformFee: 400 },
      { name: 'Insurance Advisor', minPrice: 499, platformFee: 100 },
      { name: 'Legal Consultation', minPrice: 999, platformFee: 200 },
      { name: 'Civil Lawyer', minPrice: 2499, platformFee: 500 },
      { name: 'Property Lawyer', minPrice: 2499, platformFee: 500 },
      { name: 'Family Lawyer', minPrice: 1999, platformFee: 400 },
      { name: 'Rent Agreement', minPrice: 499, platformFee: 100 },
      { name: 'Agreement Drafting', minPrice: 999, platformFee: 200 },
      { name: 'Notary', minPrice: 299, platformFee: 60 },
      { name: 'Affidavit', minPrice: 299, platformFee: 60 },
    ]
  },
  {
    name: 'Real Estate & Property', icon: '🏢', color: '#475569',
    description: 'Property buying/selling/rental, inspection, valuation, documentation and home loan assistance.',
    subs: [
      { name: 'Property Consultation', minPrice: 999, platformFee: 200 },
      { name: 'Property Buying Assistance', minPrice: 4999, platformFee: 1000 },
      { name: 'Property Selling Assistance', minPrice: 4999, platformFee: 1000 },
      { name: 'Property Rental Assistance', minPrice: 999, platformFee: 200 },
      { name: 'Property Inspection', minPrice: 999, platformFee: 200 },
      { name: 'Property Valuation', minPrice: 1499, platformFee: 300 },
      { name: 'Tenant Verification', minPrice: 499, platformFee: 100 },
      { name: 'Rental Agreement', minPrice: 499, platformFee: 100 },
      { name: 'Property Documentation', minPrice: 1999, platformFee: 400 },
      { name: 'Property Management', minPrice: 1999, platformFee: 400 },
      { name: 'Home Loan Assistance', minPrice: 999, platformFee: 200 },
      { name: 'PG / Hostel Finding', minPrice: 499, platformFee: 100 },
    ]
  },
  {
    name: 'Business & Manpower', icon: '🏭', color: '#0F172A',
    description: 'Security guards, housekeeping, manpower, printing, signage and facility management.',
    subs: [
      { name: 'Security Guard', minPrice: 799, platformFee: 160 },
      { name: 'Residential Security', minPrice: 999, platformFee: 200 },
      { name: 'Commercial Security', minPrice: 1499, platformFee: 300 },
      { name: 'Event Security', minPrice: 599, platformFee: 120 },
      { name: 'Housekeeping Staff', minPrice: 499, platformFee: 100 },
      { name: 'Office Boy', minPrice: 299, platformFee: 60 },
      { name: 'Temporary Manpower', minPrice: 499, platformFee: 100 },
      { name: 'Facility Management', minPrice: 4999, platformFee: 1000 },
      { name: 'Visiting Card Printing', minPrice: 299, platformFee: 60 },
      { name: 'Banner Printing', minPrice: 499, platformFee: 100 },
      { name: 'Flex Printing', minPrice: 399, platformFee: 80 },
      { name: 'Brochure Printing', minPrice: 699, platformFee: 140 },
      { name: 'LED Sign Board', minPrice: 2999, platformFee: 600 },
      { name: 'Shop Board', minPrice: 1499, platformFee: 300 },
      { name: 'Vehicle Branding', minPrice: 1999, platformFee: 400 },
    ]
  },
  {
    name: 'Travel & Daily Needs', icon: '✈️', color: '#0EA5E9',
    description: 'Tour packages, hotel/flight booking, visa, grocery/medicine delivery and emergency services.',
    subs: [
      { name: 'Domestic Tour Package', minPrice: 4999, platformFee: 1000 },
      { name: 'International Tour Package', minPrice: 19999, platformFee: 4000 },
      { name: 'Honeymoon Package', minPrice: 9999, platformFee: 2000 },
      { name: 'Corporate Travel', minPrice: 2999, platformFee: 600 },
      { name: 'Pilgrimage Tour', minPrice: 4999, platformFee: 1000 },
      { name: 'Hotel Booking', minPrice: 499, platformFee: 100 },
      { name: 'Flight Booking', minPrice: 199, platformFee: 40 },
      { name: 'Train Booking', minPrice: 99, platformFee: 20 },
      { name: 'Visa Assistance', minPrice: 999, platformFee: 200 },
      { name: 'Passport Assistance', minPrice: 699, platformFee: 140 },
      { name: 'Grocery Delivery', minPrice: 49, platformFee: 10 },
      { name: 'Medicine Delivery', minPrice: 49, platformFee: 10 },
      { name: 'Water Jar Delivery', minPrice: 49, platformFee: 10 },
      { name: 'Tiffin Delivery', minPrice: 49, platformFee: 10 },
      { name: 'Local Courier', minPrice: 99, platformFee: 20 },
      { name: 'Document Delivery', minPrice: 99, platformFee: 20 },
      { name: 'Errand Service', minPrice: 149, platformFee: 30 },
      { name: 'Emergency Electrician', minPrice: 299, platformFee: 60 },
      { name: 'Emergency Plumber', minPrice: 299, platformFee: 60 },
      { name: 'Emergency Locksmith', minPrice: 299, platformFee: 60 },
    ]
  },
];

// Case-insensitive normalizer for dedup
const norm = s => (s || '').toLowerCase().trim();

// Escape special regex characters
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('\n Connected to MongoDB\n');

  const stats = { created: [], updated: [], skipped: [] };

  for (const cat of MASTER) {
    const regex = new RegExp(`^${escapeRegex(cat.name.trim())}$`, 'i');
    let doc = await Category.findOne({ name: { $regex: regex } });

    if (!doc) {
      // Create brand-new category
      doc = await Category.create({
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        description: cat.description,
        active: true,
        subcategories: cat.subs.map(s => ({
          name: s.name,
          minPrice: s.minPrice,
          platformFee: s.platformFee,
          suggestedMax: s.suggestedMax || null,
          active: true
        }))
      });
      stats.created.push({ name: cat.name, subCount: doc.subcategories.length });
    } else {
      // Merge only missing subcategories
      const existingNames = new Set(doc.subcategories.map(s => norm(s.name)));
      let addedCount = 0;

      for (const sub of cat.subs) {
        if (!existingNames.has(norm(sub.name))) {
          doc.subcategories.push({
            name: sub.name,
            minPrice: sub.minPrice,
            platformFee: sub.platformFee,
            suggestedMax: sub.suggestedMax || null,
            active: true
          });
          existingNames.add(norm(sub.name));
          addedCount++;
        }
      }

      if (addedCount > 0) {
        await doc.save();
        stats.updated.push({ name: doc.name, addedSubs: addedCount, total: doc.subcategories.length });
      } else {
        stats.skipped.push({ name: doc.name, total: doc.subcategories.length });
      }
    }
  }

  // ── Summary Report ──────────────────────────────────────────────────────────
  const divider = '═'.repeat(60);
  console.log(`\n${divider}`);
  console.log('  Kwickly Master Category Upsert — Summary');
  console.log(divider);

  if (stats.created.length) {
    console.log(`\n CREATED (${stats.created.length} new categories):`);
    stats.created.forEach(c => console.log(`   • ${c.name}  →  ${c.subCount} subcategories`));
  }
  if (stats.updated.length) {
    console.log(`\n UPDATED (${stats.updated.length} — subcategories merged):`);
    stats.updated.forEach(u => console.log(`   • ${u.name}  →  +${u.addedSubs} added  (total ${u.total})`));
  }
  if (stats.skipped.length) {
    console.log(`\n SKIPPED (${stats.skipped.length} already up-to-date):`);
    stats.skipped.forEach(s => console.log(`   • ${s.name}  (${s.total} subs)`));
  }

  const allCats = await Category.find({}).lean();
  const totalSubs = allCats.reduce((sum, c) => sum + (c.subcategories || []).length, 0);
  console.log(`\n${divider}`);
  console.log(`  Total categories  : ${allCats.length}`);
  console.log(`  Total subcategories : ${totalSubs}`);
  console.log(`${divider}\n`);

  process.exit(0);
}).catch(err => {
  console.error(' Error:', err.message);
  process.exit(1);
});
