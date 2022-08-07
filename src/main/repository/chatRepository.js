const ChatNotificationModel = require('../models/entity/chats/chatNotification')
const ChatLogModel = require('../models/entity/chats/chatLog')
const ChatParticipantModel = require('../models/entity/chats/chatParticipant')
const GroupModel = require('../models/entity/groups/group')
const constants = require('../constants')
const utils = require("../utils")


/**
 * Generates a default name for a chat participant
 * @param {ChatParticipantModel} chatParticipants The list of chat participants
 * @returns The generated default name
 */
function generateDefaultChatParams(chatParticipants) {
    const participants = chatParticipants
    const participantCount = participants.length
    const retainedParticipants = participants.slice(0, constants.CHAT_ITEM_NAME_GENERATION_PARTICIPANT_COUNT)
    const participantNames = retainedParticipants.map(p => p.firstName).join(constants.STRING_DELIMITER)
    const suffix = (participantCount > constants.CHAT_ITEM_NAME_GENERATION_PARTICIPANT_COUNT ? constants.PARTICIPANT_NAMES_ETC : '')
    const defaultName = retainedParticipants.length == 1 ? retainedParticipants[0].fullName : (participantNames + suffix)
    const defaultProfilePicture = retainedParticipants.map(p => p.profilePicture).join(constants.STRING_DELIMITER)
    return { defaultName, defaultProfilePicture }
}

module.exports = (chatSchema) => {
    //Note : chat notifications always come first before chat logs if they have the same creation date

    /**
     * Create
     */

    /**
     * A user defines and creates a new Chat with a list of participants and an initial conversation bubble
     * @param {ObjectId} userId The creator user id
     * @param {
     *      name: string, 
     *      profilePicture: string, 
     *      firstChatLog: string } chatMetadata The chat creation metadata
     * @param {Array[string]} participantRemoteIds The list of participant remote ids
     */
    chatSchema.statics.createAndinitializeChat = async function (userRemoteId, chatMetadata, participantRemoteIds, io) {
        if (participantRemoteIds.filter(id => id != userRemoteId).length <= 0) throw new Error()
        participantRemoteIds.push(userRemoteId)
        const userId = utils.decodeRemoteId(userRemoteId)
        const existingChat = await this.findByCreatorIdAndParticipants(userId, participantRemoteIds)
        if (existingChat)
            return { remoteId: existingChat.remoteId }

        const creationDate = Date.now()
        //transaction required
        const createdChat = await this.createChat(userId, chatMetadata)
        await GroupModel.createGroup(createdChat._id)

        await this.addChatParticipants(
            createdChat._id,
            userId,
            participantRemoteIds,
            creationDate + 1,
            io
        )
        const chatLogMetadata = [{
            chatRemoteId: createdChat.remoteId,
            content: chatMetadata.firstChatLog
        }]
        const chatNotificationMetadata = [{
            content: constants.CONVO_CREATION_MESSAGE,
            creationDate: creationDate
        }]
        await this.createChatLogs(userId, chatLogMetadata, io)
        await createdChat.createChatNotifications(chatNotificationMetadata, io)
        return { remoteId: createdChat.remoteId }
    }

    /**
     * Creates a new Chat entity and saves it into the database
     * @param {ObjectId} ownerId The owner of the Chat
     * @param {name: string, profilePicture: string} chatMetadata The new chat metadata
     * @returns The newly created Chat entity
     */
    chatSchema.statics.createChat = async function (ownerId, chatMetadata) {
        const newChat = new this({
            name: chatMetadata.name,
            profilePicture: chatMetadata.profilePicture,
            creatorId: ownerId
        })
        newChat.remoteId = utils.encodeId(newChat._id)
        await newChat.save()
        return newChat
    }

    /**
     * Adds a list of participants to a chat
     * @param {ObjectId} chatId The Chat to add participants to
     * @param {ObjectId} creatorId The user trying to add participants
     * @param {Array[string]} participantRemoteIds The participants to add by remote ids
     * @returns The list of participants added
     */
    chatSchema.statics.addChatParticipants = async function (chatId, creatorId, participantRemoteIds, addParticipantDate, io) {
        //match chat creator with user
        const chat = await this.findByIdAndCreatorId(chatId, creatorId)
        if (!chat) throw new Error()
        const newParticipants =
            participantRemoteIds
                .map(remoteId => utils.decodeRemoteId(remoteId))
                .map(id => {
                    return new ChatParticipantModel({
                        participantId: id,
                        chatId: chat._id,
                        isAdmin: creatorId == id,
                        lastReadTime: creatorId == id ? addParticipantDate + 1 : null
                    })
                })
        await ChatParticipantModel.collection.insertMany(newParticipants)
        await ChatParticipantModel.populate(newParticipants, 'user')
        const joinNotifications = newParticipants
            .map(participant => {
                const message = `${participant.user.toContact().fullName} ${constants.PARTICIPANT_JOINED_MESSAGE}.`
                return { content: message, creationDate: addParticipantDate }
            })
        if (joinNotifications.length > 2) await chat.createChatNotifications(joinNotifications, io)

        return newParticipants.map(participant => {
            return {
                data: participant.toDTO(),
                user: participant.user.toContact()
            }
        })
    }

    /**
     * Creates a list of chat logs for a given Chat
     * @param {chatRemoteId: string, content: string} payload The new chat logs data
     */
    chatSchema.statics.createChatLogs = async function (userId, payload, io) {
        const emitions = {}
        const chatLogs = await Promise.all(
            payload.map(async log => {
                const chatId = utils.decodeRemoteId(log.chatRemoteId)
                const newChatLog = new ChatLogModel({
                    content: log.content,
                    authorId: userId,
                    chatId: chatId,
                    creationDate: Date.now()
                })
                newChatLog.remoteId = utils.encodeId(newChatLog._id)
                await newChatLog.save()
                emitions[chatId] = emitions[chatId] || []
                emitions[chatId].push(newChatLog.remoteId)
                return newChatLog.remoteId
            })
        )
        await Promise.all(
            Object.keys(emitions).map(async (chatId) => {
                await this.emitMessage(io, userId, chatId, constants.SOCKET_CHAT_NEW_MESSAGE_EVENT, { remoteIds: emitions[chatId] })
            })
        )
        return chatLogs.map(remoteId => { return { remoteId } })
    }

    /**
     * Creates a list of chat notifications for a given Chat
     * @param {content: string, creationDate: string} payload The new chat notifications data
     */
    chatSchema.methods.createChatNotifications = async function (payload, io) {
        const emitions = {}
        await Promise.all(
            payload.map(async notification => {
                const newChatNotification = new ChatNotificationModel({
                    content: notification.content,
                    chatId: this._id,
                    creationDate: notification.creationDate
                })
                newChatNotification.remoteId = utils.encodeId(newChatNotification._id)
                await newChatNotification.save()
                emitions[this._id] = emitions[this._id] || []
                emitions[this._id].push(newChatNotification.remoteId)
            })
        )
        await Promise.all(
            Object.keys(emitions).map(async (chatId) => {
                await this.emitMessage(io, null, chatId, constants.SOCKET_CHAT_CHANGED_EVENT, { remoteIds: emitions[chatId] })
            })
        )
    }

    /**
     * Read
     */

    /**
     * Gets the list of chats in which a given user participates in
     * @param {ObjectId} userId The user requestion their chat list
     * @returns The list of Chat entities in which the user participates in
     */
    chatSchema.statics.getChatList = async function (userId, remoteIds) {
        const participantChats = await ChatParticipantModel.findByParticipantId(userId)
        const matchQuery = remoteIds ? { remoteId: { $in: remoteIds } } : null
        await ChatParticipantModel.populate(participantChats, {
            path: 'chat',
            match: matchQuery,
            populate: [
                {
                    path: 'latestChatLog',
                    options: { sort: { creationDate: -1 } },
                    populate: 'author'
                },
                {
                    path: 'participants',
                    populate: 'user'
                }
            ]
        })

        return participantChats.map(participantData => {
            const dto = participantData.chat.toDTO()
            const participants = participantData.chat.participants.filter(p => p.participantId.toString() != userId).map(p => p.user.toContact())
            const generatedParams = generateDefaultChatParams(participants)
            dto.name = dto.name || generatedParams.defaultName
            dto.profilePicture = dto.profilePicture || generatedParams.defaultProfilePicture
            //last active
            const lastActiveTime = Math.max.apply(Math, participants.map(p => p.lastActive))
            return {
                chat: dto,
                lastActive: lastActiveTime,
                lastReadTime: participantData.lastReadTime,
                latestChatLog: participantData.chat.latestChatLog.toPopulatedDTO(userId, dto.remoteId),
                isGroupChat: participants.length > 1
            }
        })
    }

    /**
     * Retrieves chat data requested by a given user
     * @param {ObjectId} chatId The id of the chat we need Data about
     * @param {ObjectId} userId The user requesting the Data
     * @returns The chat data
     */
    chatSchema.statics.getChatData = async function (chatId, userId) {
        const chatParticipant = await ChatParticipantModel.findByChatIdAndParticipantId(chatId, userId)
        if (!chatParticipant) throw new Error()
        await chatParticipant.populate('chat')
        const chatDTO = chatParticipant.chat.toDTO()
        const group = await chatParticipant.chat.getGroupData(userId)
        const participantsData = await chatParticipant.chat.getDisplayedParticipantsData(userId)
        //auto generated name/pictures for chat
        const generatedParams = generateDefaultChatParams(participantsData.displayedParticipants.map(p => p.user))
        chatDTO.name = chatDTO.name || generatedParams.defaultName
        chatDTO.profilePicture = chatDTO.profilePicture || generatedParams.defaultProfilePicture
        //last active
        const lastActiveTime = Math.max.apply(Math, participantsData.displayedParticipants.map(p => p.user.lastActive))
        return {
            chat: chatDTO,
            group: group,
            lastActive: lastActiveTime,
            lastReadTime: chatParticipant.lastReadTime,
            lastGroupReadTime: chatParticipant.lastGroupReadTime,
            isAdmin: chatParticipant.isAdmin,
            participantsData: participantsData
        }
    }

    /**
     * Gets the group bound to a given chat
     * @returns The group entity
     */
    chatSchema.methods.getGroupData = async function () {
        await this.populate('group')
        return await this.group.toDTO()
    }

    /**
     * Gets the list of participants for a given Chat
     * @returns The list of participants
     */
    chatSchema.methods.getDisplayedParticipantsData = async function (userId) {
        await this.populate([
            'participantCount',
            {
                path: 'participants',
                options: { limit: constants.GROUP_PARTICIPANTS_DISPLAY_COUNT },
                populate: 'user'
            }
        ])
        const remainingCount = this.participantCount - this.participants.length
        const displayedParticipants = this.participants
            .filter(p => p.participantId.toString() != userId)
            .map(participant => {
                return {
                    data: participant.toDTO(),
                    user: participant.user.toContact()
                }
            })
        return { displayedParticipants, remainingCount }
    }

    chatSchema.statics.getChatBubbles = async function (userId, chatRemoteId) {
        const chatId = utils.decodeRemoteId(chatRemoteId)
        const participant = await ChatParticipantModel.findByChatIdAndParticipantId(chatId, userId)
        if (!participant) throw new Error()
        await participant.populate({
            path: 'chat',
            populate: [
                'notificationLogs',
                {
                    path: 'chatLogs',
                    populate: {
                        path: 'author',
                        select: 'remoteId'
                    }
                }
            ]
        })
        await ChatLogModel.populate(participant.chat.chatLogs, 'author')
        const logs = await participant.chat.chatLogs.map(log => log.toPopulatedDTO(userId, chatRemoteId))
        const notifications = await participant.chat.notificationLogs.map(log => log.toPopulatedDTO(chatRemoteId))
        return { logs, notifications }
    }

    chatSchema.statics.getNewChatLogs = async function (userId, chatLogRemoteIds) {
        const chatLogs = await ChatLogModel.findByRemoteIds(chatLogRemoteIds)
        await ChatLogModel.populate(chatLogs, ['chat', 'author'])
        return await Promise.all(
            chatLogs.map(async log => {
                const participant = await ChatParticipantModel.findByChatIdAndParticipantId(log.chat._id, userId)
                if (!participant) throw new Error()
                return log.toPopulatedDTO(userId)
            })
        )
    }

    chatSchema.statics.getNewChatNotifications = async function (userId, chatNotificationRemoteIds) {
        const chatNotifications = await ChatNotificationModel.findByRemoteIds(chatNotificationRemoteIds)
        await ChatNotificationModel.populate(chatNotifications, ['chat'])
        return await Promise.all(
            chatNotifications.map(async notification => {
                const participant = await ChatParticipantModel.findByChatIdAndParticipantId(notification.chat._id, userId)
                if (!participant) throw new Error()
                return notification.toPopulatedDTO()
            })
        )
    }

    /**
     * Update
     */

    chatSchema.statics.emitMessage = async function (io, userId, chatId, eventKey, message, excludeSelf = false) {
        const chatParticipants = await ChatParticipantModel.findByChatId(chatId)
        if (chatParticipants.length > 0) {
            let ioBuilder = io
            let participantIds = chatParticipants.map(p => p.participantId.toString())
            if (excludeSelf && userId)
                participantIds = participantIds.filter(p => p != userId.toString())

            participantIds.forEach(id => { ioBuilder = ioBuilder.to(id)})
            ioBuilder.emit(eventKey, message)
        }
    }

    /**
     * Updates the Chats owned and requested by a given User
     * @param {ObjectId} userId The id of the user making changes to the Chat
     * @param { Array[{ chatRemoteId: string, 
     *                  name: string, 
     *                  profilePicture: string }] } payload The payload with the updates requested
     * @returns The update results
     */
    chatSchema.statics.updateChats = async function (userId, payload) {
        const bulkUpdate =
            payload.map(chat => {
                return {
                    updateOne: {
                        filter: { remoteId: chat.chatRemoteId, creatorId: userId },
                        update: { $set: { name: chat.name, profilePicture: chat.profilePicture } }
                    }
                }
            })
        const writeResult = await this.bulkWrite(bulkUpdate)
        if (writeResult.nMatched < payload.length) throw new Error()
        return {
            matched: writeResult.nMatched,
            modified: writeResult.nModified
        }
    }

    chatSchema.statics.readChat = async function (userId, chatId, io) {
        const participant = await ChatParticipantModel.findByChatIdAndParticipantId(chatId, userId)
        if (!participant) throw new Error()
        participant.lastReadTime = Date.now()
        await participant.save()
        await participant.populate([{ path: 'chat', select: 'remoteId' }, { path: 'user', select: 'remoteId' }])
        await this.emitMessage(io, userId, chatId, constants.SOCKET_CHAT_READ_EVENT, {
            chatRemoteId: participant.chat.remoteId,
            participantRemoteId: participant.user.remoteId,
            readTime: participant.lastReadTime
        }, true)
        return {
            chatRemoteId: participant.chat.remoteId,
            lastReadTime: participant.lastReadTime
        }
    }

    /**
     * Updates a list of participants from various chats owned by a given user
     * @param {ObjectId} userId The id of the user trying to update a Chat's participants
     * @param { Array[{ chatRemoteId: string, 
     *                  userRemoteId: string, 
     *                  isAdmin: boolean }] } payload The payload with the changes requested
     * @returns The update results
     */
    chatSchema.statics.updateChatParticipants = async function (userId, payload) {
        let matched = 0
        let modified = 0
        await Promise.all(
            payload.map(async participant => {
                const chatId = utils.decodeRemoteId(participant.chatRemoteId)
                const participantId = utils.decodeRemoteId(participant.userRemoteId)
                const foundParticipant = await ChatParticipantModel.findByChatIdAndParticipantId(chatId, participantId)
                if (!foundParticipant) throw Error()
                matched++
                await foundParticipant.populate('chat')
                if (foundParticipant.chat.creatorId == userId) {
                    foundParticipant.isAdmin = participant.isAdmin
                    await foundParticipant.save()
                    modified++
                }
                return foundParticipant.toDTO()
            })
        )
        return { matched, modified }
    }

    /**
     * Delete
     */
    /**
     * Removes a participant from a chat
     * @param {ObjectId} chatId The id of the chat in which to remove the participant
     * @param {ObjectId} userId The id of the user initiating the removal
     * @param {ObjectId} participantId The id of the participant to remove
     */
    chatSchema.statics.deleteParticipant = async function (chatId, userId, participantId, io) {
        const chat = await this.findByIdAndCreatorId(chatId, userId)
        if (chat && userId == participantId) throw new Error('chat owner cannot kick themselves')
        const participant = await ChatParticipantModel.findByChatIdAndParticipantId(chatId, participantId)
        await participant.populate('user')
        const notificationMessage = chat ? constants.KICK_PARTICIPANT_MESSAGE : userId == participantId ? PARTICIPANT_LEFT_MESSAGE : null
        if (!notificationMessage) throw new Error('user does not have the ability to initiate the removal')
        const notificationResult = `${participant.user.toContact().fullName} ${notificationMessage}.`
        const notificationMetadata = [
            {
                content: notificationResult,
                creationDate: Date.now()
            }
        ]
        const resultNotification = await chat.createChatNotifications(notificationMetadata, io)
        const deletionResult = await ChatParticipantModel.deleteByChatIdAndParticipantId(chatId, participantId)
        if (!deletionResult.acknowledged) throw new Error('Participant deletion has failed.')
        return {
            notification: resultNotification,
            deletionCount: deletionResult.deletedCount
        }
    }


    /**
     * Keeps the list of chats that the user have access to
     * The input chats is a list of post remote ids
     * @param {ObjectId} userId The id of the user
     * @param {Array[string]} inputChats the input post remote id list
     * @returns The filtered list of chats
     */
    chatSchema.statics.getVisibleChatIds = async function (userId, inputChats) {
        let chats = await this.findByRemoteIds(inputChats)
        chats = await Promise.all(
            chats.map(async chat => {
                const foundParticipant = await ChatParticipantModel.findByChatIdAndParticipantId(chat._id, userId)
                return {
                    remoteId: chat.remoteId,
                    isParticipant: foundParticipant != null
                }
            })
        )
        return chats.filter(chat => chat.isParticipant).map(chat => chat.remoteId)
    }

}