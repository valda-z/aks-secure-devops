var mongoose = require('mongoose');

module.exports = mongoose.model('LogEvent', {
    id: String,
    entity: String,
    operation: String,
    description: String,
    created: Date
});