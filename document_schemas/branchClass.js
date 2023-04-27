const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    branchName:String,
    branchAddress:String,
    branchID:String
});

const Branch = mongoose.model('branches',branchSchema);

module.exports = ({Branch});