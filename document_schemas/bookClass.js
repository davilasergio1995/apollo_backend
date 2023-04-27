const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title:String,
    normTitle:String,
    altTitle:String,
    normAltTitle:String,
    completeTitle:String,
    completeNormTitle:String,
    masterID:String,
    authors:Array,
    normAuthors:Array,
    publishedDate:String,
    ISBN:Array,
    genres:Array,
    totalStock:Number,
    availableStock:Number,
    branchStock:Array,
    inventory:Array,
});

const Book = mongoose.model('books',bookSchema);

module.exports = ({Book});