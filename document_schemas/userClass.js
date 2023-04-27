const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    firstName:String,
    lastName:String,
    address:String,
    city:String,
    state:String,
    zipCode:String,
    email:String,
    phoneNumber:Number,
    userType:String,
    userID:String,
    sessionID:String,
    username:String,
    normUsername:String,
    password:String,
    currentLocation:String,
    fines:{type:Number,default:0},
    checkedOut:{type:Object,default:{books:0,bookIDs:[],media:0,mediaIDs:[]}},
    holds:{type:Object,default:{books:0,bookIDs:[],media:0,mediaIDs:[]}}
}
);

const User = mongoose.model('users',userSchema);

module.exports = ({User});

