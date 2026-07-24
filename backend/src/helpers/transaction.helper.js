const mongoose = require('mongoose');

const supportsTransactions = () => {
    try {
        const desc = mongoose.connection.client?.topology?.description;
        return desc && desc.type !== 'Single' && desc.type !== 'Standalone';
    } catch (e) {
        return false;
    }
};

module.exports = { supportsTransactions };
