const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly').then(async () => {
    const db = mongoose.connection.db;
    const collection = db.collection('customers');
    
    const customers = await collection.find({ role: 'WORKER' }).toArray();
    for (let c of customers) {
        if (c.kyc && Array.isArray(c.kyc.documents)) {
            let needsFix = false;
            let newDocs = c.kyc.documents.map(doc => {
                if (typeof doc === 'string') {
                    needsFix = true;
                    return { type: 'OTHER', url: doc, uploadedAt: new Date() };
                }
                return doc;
            });
            
            if (needsFix) {
                await collection.updateOne({ _id: c._id }, { $set: { 'kyc.documents': newDocs } });
                console.log('Fixed worker', c.name);
            }
        }
    }
    
    const shopCollection = db.collection('shops');
    const shops = await shopCollection.find({}).toArray();
    for (let s of shops) {
        if (s.kyc && Array.isArray(s.kyc.documents)) {
            let needsFix = false;
            let newDocs = s.kyc.documents.map(doc => {
                if (typeof doc === 'string') {
                    needsFix = true;
                    return { type: 'OTHER', url: doc, uploadedAt: new Date() };
                }
                return doc;
            });
            
            if (needsFix) {
                await shopCollection.updateOne({ _id: s._id }, { $set: { 'kyc.documents': newDocs } });
                console.log('Fixed shop', s.name);
            }
        }
    }
    
    console.log('Done fixing DB');
    process.exit(0);
}).catch(console.error);
