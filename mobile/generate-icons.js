const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = 'd:/kwickly/11-4-26/logo.jpeg';
const ANDROID_RES_PATH = path.join(__dirname, 'android/app/src/main/res');

const SIZES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

async function generateIcons() {
  try {
    const image = await Jimp.read(SOURCE_IMAGE);
    
    for (const [density, size] of Object.entries(SIZES)) {
      const targetDir = path.join(ANDROID_RES_PATH, `mipmap-${density}`);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const resized = image.clone().resize(size, size);
      
      // Save square icon
      await resized.writeAsync(path.join(targetDir, 'ic_launcher.png'));
      
      // Save round icon (same for now, as Android launcher crops it usually if no mask)
      // We can make it circular
      const rounded = resized.clone();
      // To make it round in Jimp, we can use mask or circle. But square is fine, Android adaptive icons handle it.
      await rounded.writeAsync(path.join(targetDir, 'ic_launcher_round.png'));
      
      console.log(`Generated icon for ${density} (${size}x${size})`);
    }
    
    console.log('All Android icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
