const utils = require("../utils")
const ChatParticipantModel = require('../models/entity/chats/chatParticipant')
const constants = require("../constants")

module.exports = (groupSchema) => {

    /**
     * Creates a group that will be bound to a specific Chat
     * @param {ObjectId} chatId The id of the chat the group will be bound to
     * @returns The newly created group
     */
    groupSchema.statics.createGroup = async function (chatId) {
        const newGroup = new this({ chatId })
        newGroup.remoteId = utils.encodeId(newGroup._id)
        await newGroup.save()
        return newGroup
    }

    /**
     * Update a list of groups based on the given payload by a given user
     * @param {ObjectId} userId The id of the user updating the group
     * @param { Array[  groupRemoteId: string, 
     *                  name: string,
     *                  profilePicture: string,
     *                  description: string, 
     *                  backgroundPicture: string ] } payload The update payload
     * @returns The list of updated groups
     */
    groupSchema.statics.updateGroups = async function (userId, payload, io) {
        let matched = 0
        let modified = 0
        await Promise.all(
            payload.map(async groupPayload => {
                const group = await this.findByRemoteId(groupPayload.groupRemoteId)
                await group.populate('chat')
                const groupParticipant = await ChatParticipantModel.findByChatIdAndParticipantId(group.chatId, userId)
                if (!groupParticipant || !groupParticipant.isAdmin) throw new Error()
                await groupParticipant.populate('user')
                matched += 1
                //create update notification
                if (groupPayload.name && group.chat.name != groupPayload.name) {
                    const notification = `${groupParticipant.user.toDTO().firstName} ${constants.CHAT_NAME_CHANGED_MESSAGE} ${groupPayload.name}`
                    const resultNotif = [{ content: notification, creationDate: Date.now() }]
                    await group.chat.createChatNotifications(resultNotif, io)
                }
                group.chat.name = groupPayload.name
                group.chat.profilePicture = groupPayload.profilePicture
                group.description = groupPayload.description
                group.backgroundPicture = groupPayload.backgroundPicture
                const resultChat = await group.chat.save()
                const resultGroup = await group.save()
                if (resultChat && resultGroup)
                    modified += 1
            })
        )
        return { matched, modified }
    }


    groupSchema.statics.readGroup = async function (userId, groupRemoteId) {
        const group = await this.findByRemoteId(groupRemoteId)
        await group.populate({ path: 'chat', select: 'remoteId' })
        const participant = await ChatParticipantModel.findByChatIdAndParticipantId(group.chat._id, userId)
        if (!participant) throw new Error()
        participant.lastGroupReadTime = Date.now()
        await participant.save()
        return {
            groupRemoteId: groupRemoteId,
            lastGroupReadTime: participant.lastGroupReadTime
        }
    }

    /**
     * Checks whether a given user is a participant of a given group
     * @param {ObjectId} userId The id of the user to check
     * @param {ObjectId} groupId The id of the group
     */
    groupSchema.statics.getGroupParticipant = async function (userId, groupId) {
        const group = await this.findById(groupId)
        const groupParticipant = await ChatParticipantModel.findByChatIdAndParticipantId(group.chatId, userId)
        return groupParticipant
    }

    /**
     * Keeps the list of groups that the user have access to
     * The input groups is a list of post remote ids
     * @param {ObjectId} userId The id of the user
     * @param {Array[string]} inputGroups the input post remote id list
     * @returns The filtered list of groups
     */
    groupSchema.statics.getVisibleGroupIds = async function (userId, inputGroups) {
        let groups = await this.findByRemoteIds(inputGroups)
        groups = await Promise.all(
            groups.map(async group => {
                const foundParticipant = await this.getGroupParticipant(userId, group._id)
                return {
                    remoteId: group.remoteId,
                    isParticipant: foundParticipant != null
                }
            })
        )
        return groups.filter(group => group.isParticipant).map(group => group.remoteId)
    }
}