const crypto = require('crypto');

const newID = (len) => {
    let result = '';
    let values = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < len; i++) {
        result += values.charAt(crypto.randomInt(0,values.length - 1));
    };
    return result;
};

module.exports = {newID}