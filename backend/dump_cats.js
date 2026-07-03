const mongoose = require('mongoose');
const Category = require('./src/modules/category/category.model');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const cats = await Category.find().lean();
    require('fs').writeFileSync('cats_db.json', JSON.stringify(cats, null, 2));
    process.exit(0);
  });
