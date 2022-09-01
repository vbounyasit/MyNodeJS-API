const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        remoteId: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true,
            maxlength: 3000,
            trim: true
        },
        creationDate: {
            type: Number,
            required: true
        },
        authorId: {
            type: ObjectId,
            required: true
        },
        chatId: {
            type: ObjectId,
            required: true
        }
    },
    {
        timestamps: true
    }
)

schema.virtual('author', {
    ref: 'Users',
    localField: 'authorId',
    foreignField: '_id',
    justOne: true
})

schema.virtual('chat', {
    ref: 'Chats',
    localField: 'chatId',
    foreignField: '_id',
    justOne: true
})

schema.methods.toDTO = function () {
    return {
        remoteId: this.remoteId,
        content: this.content,
        creationTimeStamp: this.creationDate,
        updateTimeStamp: this.updatedAt.getTime()
    }
}
schema.methods.toPopulatedDTO = function(userId, chatRemoteId){
    const dto = this.toDTO()
    dto.chatRemoteId = chatRemoteId || this.chat.remoteId
    dto.author = this.author.toContact()
    dto.isMe = this.authorId.toString() == userId.toString()
    return dto
}

schema.statics.findLatest = async function (chatId) {
    return this.findOne({ chatId }).sort({ creationTimeStamp: -1 })
}

schema.statics.findByRemoteIds = async function(remoteIds){
    return this.find({remoteId: { $in : remoteIds }})
}

module.exports = model('ChatLogs', schema)