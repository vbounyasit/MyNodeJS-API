const UserModel = require('../models/entity/users/user')
const TokenModel = require('../models/entity/users/userToken')

const auth = async (req, res, next) => {
    try {
        const requestToken = req.header('Authorization').replace('Bearer ', '')
        const userId = UserModel.getUserIdFromAuthToken(requestToken)
        const token = await TokenModel.findByUserIdAndContent(userId, requestToken)
        if(!token) throw new Error('Unable to authenticate user')
        const user = await UserModel.findById(token.userId)
        if (!user) throw new Error('No user found for this token')
        req.authUser = user
        req.authToken = token.content
        req.authUserRemoteId = user.remoteId
        req.authUserId = user._id
        next()
    } catch (e) {
        res.status(401).send({ error: 'Unable to authenticate user' })
    }
}

module.exports = auth