const crypto = require("crypto-js")
module.exports = {
    decodeRemoteId: function(remoteId) {
        const decoded = crypto.AES.decrypt(remoteId, process.env.REMOTE_ID_SECRET)
        return decoded.toString(crypto.enc.Utf8)
    },
    encodeId: function(id) {
        return crypto.AES.encrypt(id.toString(), process.env.REMOTE_ID_SECRET)
    },
    capitalize: function(name) {
        if(!name) return name
        return name.charAt(0).toUpperCase() + name.slice(1)
    },
    isSameStringArray: function(e1, e2) {
        return e1.sort().join() === e2.sort().join()
    }
}