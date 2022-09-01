const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId
const ChatSettingsModel = require('../users/chatSettings')
const ChatNotificationModel = require('./chatNotification')
const ChatLogModel = require('./chatLog')
const ChatParticipantModel = require('./chatParticipant')
const GroupModel = require('../groups/group')

const repository = require('../../../repository/chatRepository')
const utils = require('../../../utils')

const schema = new Schema(
    {
        remoteId: {
            type: String,
            unique: true,
            required: true
        },
        name: String,
        profilePicture: String,
        creatorId: {
            type: ObjectId,
            required: true
        }
    },
    {
        timestamps: true
    }
)

schema.index({remoteId: 1, creatorId: 1}, { unique: true })

schema.virtual('participants', {
    ref: 'ChatParticipants',
    localField: '_id',
    foreignField: 'chatId'
})


schema.virtual('participantCount', {
    ref: 'ChatParticipants',
    localField: '_id',
    foreignField: 'chatId',
    count: true
})

schema.virtual('chatLogs', {
    ref: 'ChatLogs',
    localField: '_id',
    foreignField: 'chatId'
})

schema.virtual('latestChatLog', {
    ref: 'ChatLogs',
    localField: '_id',
    foreignField: 'chatId',
    justOne: true
})

schema.virtual('notificationLogs', {
    ref: 'ChatNotifications',
    localField: '_id',
    foreignField: 'chatId'
})

schema.virtual('group', {
    ref: 'Groups',
    localField: '_id',
    foreignField: 'chatId',
    justOne: true
})

schema.methods.toDTO = function() {
    return {
        remoteId: this.remoteId,
        name: utils.capitalize(this.name),
        profilePicture: this.profilePicture
    }
}

schema.statics.findByCreatorId = async function(creatorId) {
    return this.find({ creatorId })
}

schema.statics.findByRemoteIds = async function(remoteIds){
    return this.find({ remoteId: { $in : remoteIds }})
}

schema.statics.findByIdAndCreatorId = async function(_id, creatorId) {
    return this.findOne({ _id, creatorId })
}

schema.statics.findByCreatorIdAndParticipants = async function(creatorId, participantRemoteIds) {
    const createdChats = await this.findByCreatorId(creatorId)
    await this.populate(createdChats, {
        path: 'participants',
        populate: {
            path: 'user',
            select: 'remoteId'
        }
    })
    const foundChat = createdChats.find(chat => {
        return utils.isSameStringArray(chat.participants.map(p => p.user.remoteId), participantRemoteIds)
    })
    return foundChat
}

repository(schema)

schema.pre('deleteOne', async function (next) {
    const entity = await this.getQuery()
    const query = { chatId: entity._id }
    await ChatLogModel.deleteMany(query)
    await ChatParticipantModel.deleteMany(query)
    await ChatSettingsModel.deleteMany(query)
    await ChatNotificationModel.deleteMany(query)
    await GroupModel.deleteOne(query)
    next()
})


module.exports = model('Chats', schema)