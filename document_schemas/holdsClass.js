const mongoose = require('mongoose');

const holdSchema = new mongoose.Schema(
    {title:String,
    normTitle:String,
    masterID:String,
    holdRequests:Array,}
);

const Hold = mongoose.model('holds',holdSchema);

module.exports = ({Hold});