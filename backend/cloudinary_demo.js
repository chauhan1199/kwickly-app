const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: 'ap6ozddu',
  api_key: '173621885894797',
  api_secret: 'mm-__IJCIyDQRFXbJRpGQhIezhg'
});

async function runDemo() {
  try {
    // 2. Upload an image
    console.log('Uploading sample image...');
    const uploadResult = await cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
      folder: 'onboarding'
    });
    console.log('Upload successful!');
    console.log('Secure URL:', uploadResult.secure_url);
    console.log('Public ID:', uploadResult.public_id);

    // 3. Get image details
    console.log('\nImage Metadata:');
    console.log('Width:', uploadResult.width);
    console.log('Height:', uploadResult.height);
    console.log('Format:', uploadResult.format);
    console.log('File size (bytes):', uploadResult.bytes);

    // 4. Transform the image
    // f_auto: Automatically select optimal format
    // q_auto: Automatically optimize quality
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: 'auto',
      quality: 'auto'
    });

    console.log('\nDone! Click link below to see optimized version of the image. Check the size and the format.');
    console.log(transformedUrl);

  } catch (error) {
    console.error('Error during Cloudinary demo:', error);
  }
}

runDemo();
