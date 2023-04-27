const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const apollo = express();
const jwt = require('jsonwebtoken');
const Axios = require('axios');
const server = http.createServer(apollo);
const cors = require('cors');
const bp = require('body-parser');
const bcrypt = require('bcrypt');
const keys = require('dotenv').config();
const {User} = require('./document_schemas/userClass.js');
const {Book} = require('./document_schemas/bookClass.js');
const {Hold} = require('./document_schemas/holdsClass.js');
const {Branch} = require('./document_schemas/branchClass.js');

const {newID} = require('./rValGen.js');
const userClass = require('./document_schemas/userClass.js');
const { clearScreenDown } = require('readline');

apollo.use(cors());
apollo.use(bp.json())
apollo.use(bp.urlencoded({ extended: true }));

let verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]
    if (token === null) res.sendStatus(401);
    jwt.verify(token,process.env.A_TOKEN_SECRET_KEY, (err,user) => {
        if (err) {
            res.sendStatus(403);
        } else {
            req.user = user;
            next();
        }
    });
};

let verifySession = async(req,res,next) => {
    try{
        let findUser = await User.findOne({sessionID:req.headers['sessionID']});
        if (!findUser) {
            res.sendStatus(403);
        } else {
            res.locals.userType = findUser.userType;
            res.locals.userDoc = findUser;
            next();
        }
    } catch(err) {
        console.log('Error occured at session verification:',err);
    };
};

apollo.post('/api/signup', async(req,res) => {
    try {
        let user = req.body;
        console.log(user);
        let idQuery = await User.findOne({sessionID:user.userID}).exec();
        let userQuery = await User.findOne({normUsername:user.username.toUpperCase()}).exec();
        let hashedPassword = await bcrypt.hash(user.password,10);
        
        if (userQuery) {
            res.send('Username already exists');
        } else if (!idQuery || idQuery.userType === 'customer') {
            res.send('Invalid admin/librarian ID');
        } else if (idQuery.userType !== 'admin' && user.userType !== 'customer') {
            res.send('Insufficient clearance level');
        } else {
                let newUser = new User({firstName:user.firstName,lastName:user.lastName,address:user.address,city:user.city,state:user.state,zipCode:user.zipCode,email:user.email,phoneNumber:user.phoneNumber,userType:user.userType,userID:newID(16),username:user.username,normUsername:user.username.toUpperCase(),password:hashedPassword});
                await newUser.save();
                res.send('signup successful');
        }
    } catch (err) {
        console.log("Error occured at signup POST request: " + err);
    };
});

apollo.get('/api/getbranches',async(req,res) => {
    try {
        let getBranches = await Branch.find({});
        let branches = getBranches.map(e => e.branchName);
        res.send(branches);
    } catch (error) {
        console.log('Error occured at get branches GET request:',err);
    }
});

apollo.get('/api/holdfloatget',verifySession,verifyToken,async(req,res) => {
    try {
        let findHolds = await Hold.find({holdRequests:{$elemMatch:{holdLocation:req.query.currentLocation}}});
        res.send(findHolds);
    } catch (error) {
        console.log('Error occured at hold/float GET request:',error);
    };
})

apollo.post('/api/login', async(req,res) => {
    try{
        let login = req.body;
        let loginQuery = await User.findOne({normUsername:login.username.toUpperCase()}); 
        let compare = await bcrypt.compare(login.password,loginQuery.password);
        if (!compare || !loginQuery) {
            res.send('invalid login');
        } else {
            let sessionID = newID(32);
            let accessToken = jwt.sign(login.username,process.env.A_TOKEN_SECRET_KEY);
            await User.findOneAndUpdate({normUsername:login.username.toUpperCase()},{sessionID:sessionID,currentLocation:login.currentLocation}).exec();
            let newQuery = await User.findOne({sessionID:sessionID});
            res.json({accessToken:accessToken,sessionID});
        }  
    } catch(err) {
        console.log('Error occured in login POST request: ' + err);
    };
});

apollo.get('/api/confirmusertype',verifyToken,async(req,res) => {
    try{
        let sessionID = req.query.sessionID;
        console.log(sessionID);
        let findUser = await User.findOne({sessionID:sessionID}).exec();
        res.send(findUser.userType);
    } catch(err) {
        console.log('Error occured in confirm user type GET request: ' + err);
    }
});

let normalize = (str) => str.replace(/[^a-zA-Z0-9 ]/g,'').toUpperCase().split('').filter(e => e!== ' ').join('');

apollo.get('/api/books',async(req,res) => {
    try{
        let normQuery = normalize(req.query.query);
        let dbQuery = req.query.queryType === 'Book' ? await Book.find({normTitle:{$regex:normQuery}}) : await Book.find({normAuthors:normQuery});

        res.send(dbQuery);
    } catch(err) {
        console.log('Error occured in books GET request: ' + err);
    }
});

apollo.post('/api/holdfloatrequests',async(req,res) => {
    try{
        let request = req.body.request;
        console.log(request.holdType);
        let currTime = new Date().getTime();
        let expiration = currTime + (1000 * 60 * 60 * 24 * 14);
        let expirationDate = new Date(expiration);

        let findUser = await User.findOne({userID:request.userID});
        let findTitle = await Book.findOne({masterID:request.masterID});
        let findHold = await Hold.findOne({masterID:request.masterID});

        let hold = {
            holdType:request.holdType,
            floatToLocation: request.floatToLocation,
            floatFromLocation: request.floatFromLocation,
            holdLocation:request.holdLocation,
            expirationDate:expirationDate,
            userID:request.userID,
            userName:findUser.firstName + ' ' + findUser.lastName,
            bookID:'',
            onShelf:false
        };

        if(!findUser) {
            res.sendStatus(404);
        };

        if (findHold) {
            await Hold.findOneAndUpdate({masterID:request.masterID},{$push:{holdRequests:hold}}).exec();
            await Book.findOneAndUpdate({masterID:request.masterID},{$inc:{availableStock:-1,}}).exec();
            await Book.findOneAndUpdate({masterID:request.masterID,'branchStock.branch':request.holdLocation ? request.holdLocation : request.floatFromLocation},{$inc:{'branchStock.$.stock':-1}} );
            await User.findOneAndUpdate({userID:request.userID},{$inc:{'holds.books':1},$push:{'holds.bookIDs':request.masterID}}).exec(); 
            res.send('request successful');
        } else {
            let newHold = new Hold({title:request.title,normTitle:normalize(request.title),masterID:request.masterID});
            newHold.holdRequests.push(hold);
            await Book.findOneAndUpdate({masterID:request.masterID},{$inc:{availableStock: -1}}).exec();
            await Book.findOneAndUpdate({masterID:request.masterID,'branchStock.branch':request.holdLocation ? request.holdLocation : request.floatFromLocation},{$inc:{'branchStock.$.stock':-1}});
            await User.findOneAndUpdate({userID:request.userID},{$inc:{'holds.books':1},$push:{'holds.bookIDs':request.masterID}}).exec(); 
            newHold.save();
            res.send('request successful');
        };
    } catch(err) {
        console.log('Error occured in hold/float POST request',err);
    };
});

mongoose.set("strictQuery", false);
mongoose.connect("mongodb://localhost:27017/apollo_db",{
    useNewUrlParser: true,
    useUnifiedTopology: true
}, (err) => {
    if (err) {
        console.log(`Error in mongoose connection: ${err}`);
    } else {
        console.log('MongoDB connection successful');
    }
});

server.listen(8000,() => {
    console.log('server listening on port 8000');
});



// let authorCount = 0;
// let authors = ['kurt+vonnegut','brandon+sanderson','j.r.r+tolkien','brandon+sanderson','eoin+colfer','jonathan+stroud','patrick+rothfuss','donna+tartt','cornelia+funke','clive+barker','suzanne+collins','edgar+allan+poe','terry+pratchett'];
// let bookFetch = async() => {
//     try {
//         let fetchedBooks = [];
//         let libraryLocations = ['Kanto','Johto','Hoenn','Sinnoh','Unova','Kalos','Alola','Galar','Paldea'];
//         class Stock {
//             constructor(branch,stock) {
//                 this.branch=branch;
//                 this.stock=stock;
//             }
//         };
    
//         if (authorCount < authors.length) {
//             await Axios.get(`https://www.googleapis.com/books/v1/volumes?q=author:${authors[authorCount]}&printType:books&maxResults=40&key=AIzaSyDvgeM81hADG5-0lYSZMYLXsN0IL-0ebzo`)
//             .then((response) => response.data.items.forEach(e => fetchedBooks.push(e.volumeInfo))).catch((err) => console.log('Error at Google Books GET request: ' + err));
     
//             fetchedBooks.forEach((e) => {
//                 let randomVal = Math.floor(Math.random() * 15) + 1;
//                 let libraryInventory = libraryLocations.map(e => new Stock(e,0));
//                 let newBook = new Book({title:e.title,normTitle:normalize(e.title),authors:e.authors,masterID:newID(13),publishedDate:e.publishedDate,genres:e.categories,ISBN:e.industryIdentifiers,totalStock:randomVal,availableStock:randomVal,branchStock:libraryInventory});
//                 for (let i=0;i < newBook.totalStock;i++) {
//                     let newInventory = {
//                         bookID: newID(16),
//                         bookLocation: libraryLocations[Math.floor(Math.random() * libraryLocations.length)],
//                         checkedOut: false,
//                         checkedOutDate: '',
//                         checkedOutID: '',
//                         onHold: false,
//                         holdDate: '',
//                         holdID:'',
//                         holdList:''
//                     };
//                     newBook.branchStock.forEach(f => f.branch === newInventory.bookLocation ? f.stock++ : null);
//                     newBook.inventory.push(newInventory);
//                 };
//                 newBook.authors.forEach(e => newBook.normAuthors.push(normalize(e)));
//                 newBook.save();
//         });
//             authorCount+=1;
//             console.log('\x1b[36m%s\x1b[0m','Batch of documents successfully saved');
//         }
        
//     } catch (err) {
//         console.log('Error occured at Google fetch request: ' + err);
//     };
// };

// setInterval(bookFetch,1001);