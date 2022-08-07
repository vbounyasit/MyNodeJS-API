const bcrypt = require('bcryptjs')
const crypto = require("crypto-js")
const jwt = require('jsonwebtoken')
const constants = require('../constants')
const PostModel = require('../models/entity/posts/post')
const ChatModel = require('../models/entity/chats/chat')
const GroupModel = require('../models/entity/groups/group')
const UserContactModel = require('../models/entity/users/userContact')
const UserSettingsModel = require('../models/entity/users/userSettings')
const PostSettingsModel = require('../models/entity/users/postSettings')
const ChatSettingsModel = require('../models/entity/users/chatSettings')
const GroupSettingsModel = require('../models/entity/users/groupSettings')
const TokenModel = require('../models/entity/users/userToken')
const utils = require('../utils')

module.exports = (userSchema) => {

    /**
     * Decodes an authenticator token into an id
     * @param {string} authToken The authentication token
     * @returns The decoded user id
     */
    userSchema.statics.getUserIdFromAuthToken = function (authToken) {
        const decoded = jwt.verify(authToken, process.env.TOKEN_SECRET)
        return decoded._id
    }

    /**
     * Creates a new user and saves it into the database.
     * Will also generate unique default settings for it
     * @param { user, 
     *          settings: { language: string } } userRequest The request object used for creating a user 
     * @returns The created user
     */
    userSchema.statics.createUser = async function (userRequest) {
        const user = new this({
            email: userRequest.email,
            username: userRequest.username,
            password: userRequest.password,
            firstName: userRequest.firstName,
            lastName: userRequest.lastName,
            profilePicture: userRequest.profilePicture || constants.DEFAULT_PROFILE_PICTURE,
            gender: userRequest.gender,
            birthDay: userRequest.birthDay,
            lastActive: Date.now()
        })
        user.remoteId = utils.encodeId(user._id)
        await user.save()
        const generatedSettings = await user.generateDefaultSettings(userRequest.settings)
        return {
            user: user.toDTO(),
            settings: generatedSettings.userSettings,
            postSettings: generatedSettings.postSettings,
            chatSettings: generatedSettings.chatSettings,
            groupSettings: generatedSettings.groupSettings
        }
    }

    /**
     * Generates default settings for a given user and post settings
     * @param {language: string} settings Additional settings parameters to take into account 
     * @returns The generated settings
     */
    userSchema.methods.generateDefaultSettings = async function (settings) {
        const userSettings = await this.createUserSettngs(settings)
        const postSettings = await this.createPostSettings()
        const chatSettings = await this.createChatSettings()
        const groupSettings = await this.createGroupSettings()
        return {
            userSettings: userSettings.toDTO(),
            postSettings: postSettings.toDTO(),
            chatSettings: chatSettings.toDTO(),
            groupSettings: groupSettings.toDTO()
        }
    }

    /**
     * Generates default userSettings for a given user that has just been created
     * @param {string} userId The user's database id
     * @param {language: string} settings Additional settings parameters to take into account  
     * @returns The default generated userSettings attached to this 
     */
    userSchema.methods.createUserSettngs = async function (settings) {
        const userSettings = new UserSettingsModel({
            language: settings.language,
            eventPushNotifications: true,
            chatPushNotifications: true,
            userId: this._id
        })
        await userSettings.save()
        return userSettings
    }

    /**
     * Generates default settings for posts
     * - a list of post remote ids provided for each settings
     * @returns The generated post settings
     */
    userSchema.methods.createPostSettings = async function () {
        const postSettings = new PostSettingsModel({
            notifications: [],
            stickied: [],
            saved: [],
            userId: this._id
        })
        await postSettings.save()
        return postSettings
    }

    /**
     * Generates default settings for chats
     * - a list of chat remote ids provided for each settings
     * @returns The generated chat settings
     */
    userSchema.methods.createChatSettings = async function () {
        const chatSettings = new ChatSettingsModel({
            notifications: [],
            stickied: [],
            userId: this._id
        })
        await chatSettings.save()
        return chatSettings
    }

    /**
     * Generates default settings for groups
     * - a list of group remote ids provided for each settings
     * @returns The generated group settings
     */
    userSchema.methods.createGroupSettings = async function () {
        const groupSettings = new GroupSettingsModel({
            notifications: [],
            pushNotifications: [],
            userId: this._id
        })
        await groupSettings.save()
        return groupSettings
    }

    /**
     * Generates a new authentication token for a user that logs in with a given device
     * @param {string} deviceId The id of the device which the user is authenticating through
     * @returns The generated authentication token
     */
    userSchema.methods.generateToken = async function (deviceId) {
        const signed = jwt.sign({ _id: this._id.toString() }, process.env.TOKEN_SECRET)
        const token = new TokenModel({
            content: signed,
            deviceId: deviceId,
            userId: this._id
        })
        await token.save()
        return token
    }

    /**
     * Retrieves an existing authentication token or generates a new one
     * @param {string} deviceId - The device id of the device trying to authenticate
     * @returns the user's authentication token
     */
    userSchema.methods.getToken = async function (deviceId) {
        const existingTokens = await TokenModel.findByUser(this)
        const tokensEligibility = await Promise.all(existingTokens.map(async token => {
            const isCorrect = await bcrypt.compare(deviceId, token.deviceId)
            return { token, isCorrect }
        }))
        const correctToken = tokensEligibility
            .find(token => token.isCorrect)

        const generatedToken = correctToken ? correctToken.token : await this.generateToken(deviceId)
        return generatedToken
    }

    userSchema.methods.getUserData = async function () {
        await this.populate(['settings', 'postSettings', 'chatSettings', 'groupSettings'])
        return {
            user: this.toDTO(),
            settings: this.settings.toDTO(),
            postSettings: this.postSettings.toDTO(),
            chatSettings: this.chatSettings.toDTO(),
            groupSettings: this.groupSettings.toDTO()
        }
    }

    /**
     * Updates a given user data
     * @param {
     *          email: string, 
     *          firstName: string, 
     *          lastName: string, 
     *          profilePicture: string, 
     *          description: string } newUser The new user
     */
    userSchema.methods.updateUser = async function (newUser) {
        const updateResult = await this.constructor.updateUser(this._id, newUser)
        if (!updateResult.acknowledged) throw Error()
        return {
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
        }
    }

    /**
     * Updates a given user's settings
     * @param { language: string, 
     *          eventPushNotifications: boolean, 
     *          chatPushNotifications: boolean } newSettings The new settings
     * @returns The updated settngs
     */
    userSchema.methods.updateUserSettings = async function (newSettings) {
        const updateResult = await UserSettingsModel.updateSettings(this._id, newSettings)
        if (!updateResult.acknowledged) throw Error()
        return {
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
        }
    }

    /**
     * Updates a given user's post settings : 
     * - each setting has a list of posts by remote ids to which the setting will be applied to
     * @param { notifications: Array[string], 
     *          stickied: Array[string], 
     *          saved: Array[string]} newSettings The new settings
     * @returns The updated settings
     */
    userSchema.methods.updatePostSettings = async function (newSettings) {
        newSettings.notifications = await PostModel.getVisiblePostIds(this._id, newSettings.notifications)
        newSettings.stickied = await PostModel.getVisiblePostIds(this._id, newSettings.stickied)
        newSettings.saved = await PostModel.getVisiblePostIds(this._id, newSettings.saved)
        const updateResult = await PostSettingsModel.updateSettings(this._id, newSettings)
        if (!updateResult.acknowledged) throw Error()
        return {
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
        }
    }

    /**
     * Updates a given user's chat settings : 
     * - each setting has a list of chats by remote ids to which the setting will be applied to
     * @param {ObjectId} userId The id of the user updating their chat settings
     * @param { notifications: Array[string], 
     *          stickied: Array[string] } newSettings The new settings
     * @returns The updated settings
     */
    userSchema.methods.updateChatSettings = async function (newSettings) {
        newSettings.notifications = await ChatModel.getVisibleChatIds(this._id, newSettings.notifications)
        newSettings.stickied = await ChatModel.getVisibleChatIds(this._id, newSettings.stickied)
        const updateResult = await ChatSettingsModel.updateSettings(this._id, newSettings)
        if (!updateResult.acknowledged) throw Error()
        return {
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
        }
    }

    /**
     * Updates a given user's group settings : 
     * - each setting has a list of groups by remote ids to which the setting will be applied to
     * @param { notifications: Array[string], 
     *          pushNotifications: Array[string] } newSettings The new settings
     * @returns The updated settings
     */
    userSchema.methods.updateGroupSettings = async function (newSettings) {
        newSettings.notifications = await GroupModel.getVisibleGroupIds(this._id, newSettings.notifications)
        newSettings.pushNotifications = await GroupModel.getVisibleGroupIds(this._id, newSettings.pushNotifications)
        const updateResult = await GroupSettingsModel.updateSettings(this._id, newSettings)
        if (!updateResult.acknowledged) throw Error()
    }

    /**
     * Logs a user in based on the provided credentials : id (username or email), password
     * Either retrieves the existing auth token from the database or generates a new one
     * @param {id: string, password: string, deviceId: string} credentials the user's credentials
     * @returns The user, user settings and token data retrieved
     */
    userSchema.statics.logUserIn = async function (credentials) {
        const user = await this.findByEmail(credentials.id) || await this.findByUsername(credentials.id)
        if (!user) throw new Error(`user ${credentials.id} not found`)
        const matches = await bcrypt.compare(credentials.password, user.password)
        if (!matches) throw new Error(`invalid password for ${credentials.id}`)
        const generatedToken = await user.getToken(credentials.deviceId)
        await user.populate(['settings', 'postSettings', 'chatSettings', 'groupSettings'])
        return {
            user: user.toDTO(),
            settings: user.settings.toDTO(),
            postSettings: user.postSettings.toDTO(),
            chatSettings: user.chatSettings.toDTO(),
            groupSettings: user.groupSettings.toDTO(),
            authToken: generatedToken.toDTO()
        }
    }

    /**
     * Logs a user out and removes their authentication token from the database
     * @param {string} authToken The token string of the authenticated user
     */
    userSchema.statics.logUserOut = async function (authToken) {
        await TokenModel.deleteByContent(authToken)
    }

    userSchema.methods.pingActivity = async function () {
        return await this.constructor.updateLastActive(this._id, Date.now())
    }

    /**
     * User contacts
     */

    /**
     * Creates a list of contact requests for a given user toward a list of users
     * @param {Array[{ userRemoteId: string }]} payload The list of users to create request for
     * @returns The creation/update result
     */
    userSchema.methods.createAddRequests = async function (remoteId) {
        const userId = utils.decodeRemoteId(remoteId)
        if (this._id == userId) throw Error()
        const existingRequest = await UserContactModel.findRelationship(userId, this._id)
        var result = null
        if (existingRequest) {
            await existingRequest.populate('initiator')
            existingRequest.accepted = true
            existingRequest.lastUpdated = Date.now()
            await existingRequest.save()
            result = existingRequest.initiator
        } else {
            relationship = await UserContactModel.updateRelationship(this._id, userId)
            await relationship.populate('receiver')
            result = relationship.receiver
        }
        return {
            contact: result.toContact(),
            accepted: existingRequest != null
        }
    }

    /**
     * Search for users given a search tag (users with full name containing the tag)
     * @param {string} searchTag The search tag 
     * @returns The found user list matching the search tag
     */
    userSchema.methods.searchUsers = async function (searchTag) {
        const contactData = await this.getContactsData()
        //contact ids
        const contactIds = contactData.contacts.map(e => e.remoteId)
        //forbidden ids
        const receivedRequestIds = contactData.receivedRequests.map(e => e.remoteId)
        const sentRequestIds = contactData.sentRequests.map(e => e.remoteId)
        const forbiddenIds = contactIds.concat(receivedRequestIds).concat(sentRequestIds)
        forbiddenIds.push(this.remoteId)
        const contactResult = await this.constructor.searchUserByNameIn(searchTag, constants.USER_SEARCH_RESULT_MAX_COUNT, contactIds)
        const searchResult = await this.constructor.searchUserByNameNotIn(searchTag, constants.USER_SEARCH_RESULT_MAX_COUNT, forbiddenIds)
        return {
            contacts: contactResult.map(user => user.toContact()),
            searchResults: searchResult.map(user => user.toContact())
        }
    }

    /**
     * Retrieves the list of the requests sent, received and contacts from a given user
     * @returns The list of contacts, requests sent, and requests received
     */
    userSchema.methods.getContactsData = async function () {
        const sentRequests = await this.getSentRequests()
        const receivedRequests = await this.getReceivedRequest()
        const contacts = await this.getContacts()
        return {
            sentRequests, receivedRequests, contacts
        }
    }

    /**
     * Retrieves the list of requests sent by a given user
     * @returns The list of requests sent
     */
    userSchema.methods.getSentRequests = async function () {
        const requests = await UserContactModel.findReceivers(this._id, false)
        await UserContactModel.populate(requests, 'receiver')
        return requests.map(request => request.receiver.toContact())
    }

    /**
     * Retrieves the list of requests received by a given user
     * @returns The list of requests received
     */
    userSchema.methods.getReceivedRequest = async function () {
        const requests = await UserContactModel.findInitiators(this._id, false)
        await UserContactModel.populate(requests, 'initiator')
        return requests.map(request => request.initiator.toContact())
    }

    /**
     * Retrieves the list of contacts from a given user
     * @returns The list of contacts
     */
    userSchema.methods.getContacts = async function () {
        const initiatedRelationships = await UserContactModel.findInitiators(this._id, true)
        const receivedRelationships = await UserContactModel.findReceivers(this._id, true)
        await UserContactModel.populate(initiatedRelationships, 'initiator')
        await UserContactModel.populate(receivedRelationships, 'receiver')
        return initiatedRelationships.map(r => r.initiator.toContact())
            .concat(receivedRelationships.map(r => r.receiver.toContact()))
    }

    /**
     * Removes a request sent/received or contact from a user's list
     * @param {Array[{ senderRemoteId/receiverRemoteId/contactRemoteId : string }]} payload The deletion payload
     * @returns The deletion result
     */
    userSchema.methods.removeRequest = async function (payload) {
        const bulkDelete = payload.map(request => {
            const otherUserId = utils.decodeRemoteId(
                request.senderRemoteId || request.receiverRemoteId || request.contactRemoteId
            )
            const cancelRequestQuery = {
                initiatorId: this._id,
                receiverId: otherUserId
            }
            const declineRequestQuery = {
                initiatorId: otherUserId,
                receiverId: this._id
            }
            if (request.senderRemoteId)
                return { deleteOne: { filter: declineRequestQuery } }
            else if (request.receiverRemoteId)
                return { deleteOne: { filter: cancelRequestQuery } }
            else
                return {
                    deleteOne: {
                        filter: { $or: [declineRequestQuery, cancelRequestQuery] }
                    }
                }
        })

        const writeResult = await UserContactModel.bulkWrite(bulkDelete)
        if (writeResult.nRemoved < payload.length) throw new Error()
        return {
            matched: writeResult.nMatched,
            deleted: writeResult.nRemoved
        }
    }
}
