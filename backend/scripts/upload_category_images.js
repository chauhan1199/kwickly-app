/**
 * Kwickly Category Image Uploader (v2 - Fixed)
 * ──────────────────────────────────────────────
 * 1. Generates clean branded gradient SVG for each category & subcategory
 * 2. Uploads via base64 data URI to Cloudinary (reliable, no emoji issues)
 * 3. Skips categories/subs already having a cloudinary.com imageUrl
 * 4. Updates MongoDB with Cloudinary URLs
 * 5. Warms Redis cache key "categories_list" with 24h TTL
 *
 * USAGE: node backend/scripts/upload_category_images.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const Category = require('../src/modules/category/category.model');

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Redis (optional, skipped gracefully) ─────────────────────────────────────
let redis = null;
try {
  const Redis = require('ioredis');
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1, enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on('error', () => { redis = null; });
} catch (_) {}

// ── Color palettes per category index ────────────────────────────────────────
const PALETTES = [
  ['#6C47FF','#9B7FFF','#E8E0FF'], // purple
  ['#10B981','#34D399','#D1FAE5'], // green
  ['#F59E0B','#FBBF24','#FEF3C7'], // amber
  ['#3B82F6','#60A5FA','#DBEAFE'], // blue
  ['#EC4899','#F472B6','#FCE7F3'], // pink
  ['#EF4444','#F87171','#FEE2E2'], // red
  ['#8B5CF6','#A78BFA','#EDE9FE'], // violet
  ['#06B6D4','#22D3EE','#CFFAFE'], // cyan
  ['#F97316','#FB923C','#FFEDD5'], // orange
  ['#059669','#10B981','#D1FAE5'], // emerald
  ['#0EA5E9','#38BDF8','#E0F2FE'], // sky
  ['#64748B','#94A3B8','#F1F5F9'], // slate
  ['#D97706','#F59E0B','#FEF3C7'], // yellow
  ['#7C3AED','#A78BFA','#EDE9FE'], // purple dark
  ['#1E293B','#334155','#E2E8F0'], // dark slate
  ['#C2410C','#F97316','#FFEDD5'], // orange dark
  ['#475569','#64748B','#F1F5F9'], // slate mid
  ['#0D9488','#14B8A6','#CCFBF1'], // teal
  ['#E11D48','#FB7185','#FFE4E6'], // rose
  ['#0F172A','#1E293B','#E2E8F0'], // dark
  ['#B45309','#D97706','#FEF3C7'], // amber dark
  ['#0891B2','#06B6D4','#CFFAFE'], // cyan mid
  ['#7E22CE','#9333EA','#F3E8FF'], // purple bright
  ['#15803D','#16A34A','#DCFCE7'], // green dark
  ['#1D4ED8','#3B82F6','#DBEAFE'], // blue dark
];

// ── Category icon text (2-char initials, no emoji) ───────────────────────────
const CAT_ICONS = {
  'home cleaning & housekeeping': 'HC',
  'electrician services': 'EL',
  'plumbing services': 'PL',
  'carpentry & furniture': 'CP',
  'painting & waterproofing': 'PT',
  'ac & appliances': 'AC',
  'pest control': 'PC',
  'construction & renovation': 'CR',
  'security & smart home': 'SC',
  'solar & ev services': 'SE',
  'automobile services': 'AU',
  'transport & drivers': 'TR',
  'packers, movers & storage': 'PM',
  'beauty & grooming': 'BG',
  'health, fitness & wellness': 'HF',
  'baby, elder & domestic care': 'BE',
  'pet care': 'PT',
  'food, catering & laundry': 'FC',
  'gardening & landscaping': 'GL',
  'education & training': 'ET',
  'events & wedding': 'EW',
  'astrology & religious services': 'AR',
  'it, digital & creative': 'IT',
  'professional & legal': 'PL',
  'real estate & property': 'RE',
  'business & manpower': 'BM',
  'travel & daily needs': 'TN',
};

const getIcon = (catName, subName) => {
  if (subName) {
    // Generate 2-char initials from subcategory name
    const words = subName.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return subName.trim().substring(0, 2).toUpperCase();
  }
  return CAT_ICONS[catName?.toLowerCase()] || catName?.substring(0, 2).toUpperCase() || 'KW';
};

// ── XML-escape special characters for safe SVG embedding ────────────────────
const xmlEscape = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')
  .replace(/[\u2026\u2019\u2018\u201C\u201D]/g, '...');  // replace smart quotes / ellipsis

// ── Short label (max chars to fit in SVG) ────────────────────────────────────
const shortLabel = (s, max = 18) => s.length > max ? s.substring(0, max - 1) + '...' : s;

// ── Generate pure-text SVG (no emoji, works on all systems) ─────────────────
const makeSVG = (label, iconText, palette, size = 400) => {
  const [bg1, bg2] = palette;
  const safeLabel = xmlEscape(shortLabel(label, 20));
  const safeIcon  = xmlEscape(iconText);
  const fontSize  = label.length > 16 ? 20 : 24;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.25)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.10)"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="url(#bg)"/>
  <circle cx="${Math.round(size * 0.88)}" cy="${Math.round(size * 0.12)}" r="${Math.round(size * 0.20)}" fill="rgba(255,255,255,0.09)"/>
  <circle cx="${Math.round(size * 0.08)}" cy="${Math.round(size * 0.88)}" r="${Math.round(size * 0.16)}" fill="rgba(255,255,255,0.07)"/>
  <rect x="${Math.round(size * 0.27)}" y="${Math.round(size * 0.22)}" width="${Math.round(size * 0.46)}" height="${Math.round(size * 0.38)}" rx="${Math.round(size * 0.08)}" fill="url(#iconBg)"/>
  <text x="${size / 2}" y="${Math.round(size * 0.475)}" font-size="${Math.round(size * 0.195)}" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial Black, Helvetica, sans-serif" letter-spacing="-1">${safeIcon}</text>
  <text x="${size / 2}" y="${Math.round(size * 0.80)}" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,0.95)" font-family="Arial, Helvetica, sans-serif" letter-spacing="0.5">${safeLabel}</text>
  <text x="${size / 2}" y="${Math.round(size * 0.92)}" font-size="11" font-weight="500" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="Arial, sans-serif" letter-spacing="2">KWICKLY</text>
</svg>`;
};

// ── Upload via base64 data URI (most reliable Cloudinary method) ──────────────
const uploadSVG = async (svgString, publicId) => {
  const b64 = Buffer.from(svgString, 'utf-8').toString('base64');
  const dataUri = `data:image/svg+xml;base64,${b64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    folder: 'kwickly/categories',
    resource_type: 'image',
    overwrite: true,
    format: 'png',
    transformation: [
      { width: 400, height: 400, crop: 'fill', quality: 'auto:good', fetch_format: 'auto' }
    ],
  });
  return result.secure_url;
};

// ── Slugify ───────────────────────────────────────────────────────────────────
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 50);

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n🔗 Connected to MongoDB');
  console.log('☁️  Cloudinary cloud:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('📂 Folder: kwickly/categories\n');

  const categories = await Category.find({}).lean();
  let catNew = 0, catSkipped = 0, subNew = 0, subSkipped = 0, errors = 0;
  const allUpdated = [];

  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci];
    const palette = PALETTES[ci % PALETTES.length];
    const iconText = getIcon(cat.name, null);

    process.stdout.write(`[${String(ci + 1).padStart(2, '0')}/${categories.length}] ${cat.name.substring(0, 35).padEnd(36)} `);

    // ── Category image ──────────────────────────────────────────────────────
    let catImageUrl = cat.imageUrl;
    if (catImageUrl && catImageUrl.includes('cloudinary.com')) {
      catSkipped++;
      process.stdout.write('cat:skip ');
    } else {
      try {
        const svg = makeSVG(cat.name, iconText, palette, 400);
        catImageUrl = await uploadSVG(svg, `cat_${slug(cat.name)}`);
        catNew++;
        process.stdout.write('cat:✓ ');
      } catch (e) {
        errors++;
        process.stdout.write(`cat:ERR(${e.message.substring(0,30)}) `);
        catImageUrl = cat.imageUrl || null;
      }
    }

    // ── Subcategory images ──────────────────────────────────────────────────
    const updatedSubs = [];
    let subDone = 0;
    for (const sub of cat.subcategories) {
      let subUrl = sub.imageUrl;
      if (subUrl && subUrl.includes('cloudinary.com')) {
        subSkipped++;
      } else {
        try {
          const subIcon = getIcon(cat.name, sub.name);
          const svg = makeSVG(sub.name, subIcon, palette, 300);
          subUrl = await uploadSVG(svg, `sub_${slug(cat.name)}_${slug(sub.name)}`);
          subNew++;
          subDone++;
        } catch (e) {
          errors++;
          subUrl = sub.imageUrl || null;
        }
      }
      updatedSubs.push({ ...sub, imageUrl: subUrl });
    }

    // ── Save to MongoDB ─────────────────────────────────────────────────────
    await Category.findByIdAndUpdate(cat._id, {
      $set: { imageUrl: catImageUrl, subcategories: updatedSubs }
    });

    allUpdated.push({ ...cat, imageUrl: catImageUrl, subcategories: updatedSubs });
    console.log(`subs:+${subDone}`);

    // Throttle: 150ms between categories to avoid Cloudinary rate limit
    await new Promise(r => setTimeout(r, 150));
  }

  // ── Warm Redis ─────────────────────────────────────────────────────────────
  console.log('\n🔴 Warming Redis cache...');
  let redisDone = false;
  if (redis) {
    try {
      await new Promise(r => setTimeout(r, 800));
      const cacheData = allUpdated.map(c => ({
        _id: c._id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        description: c.description,
        imageUrl: c.imageUrl,
        active: c.active,
        subcategories: c.subcategories,
      }));
      await redis.set('categories_list', JSON.stringify(cacheData), 'EX', 86400);
      redisDone = true;
      console.log('✅ Redis warmed: "categories_list" (TTL: 24h)');
    } catch (e) {
      console.log('⚠️  Redis set error:', e.message);
    }
    try { await redis.quit(); } catch (_) {}
  } else {
    console.log('⚠️  Redis offline — cache will populate on next API call');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(58));
  console.log('  Kwickly Category Images — Final Summary');
  console.log('═'.repeat(58));
  console.log(`  Categories    : ${categories.length} total | ${catNew} uploaded | ${catSkipped} skipped`);
  const totalSubs = categories.reduce((s, c) => s + c.subcategories.length, 0);
  console.log(`  Subcategories : ${totalSubs} total | ${subNew} uploaded | ${subSkipped} skipped`);
  console.log(`  Errors        : ${errors}`);
  console.log(`  Redis cached  : ${redisDone ? 'YES (24h)' : 'NO (offline)'}`);
  console.log(`  Cloudinary    : https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/kwickly/categories/`);
  console.log('═'.repeat(58) + '\n');

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
})().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
