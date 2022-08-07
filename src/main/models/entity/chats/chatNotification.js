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
            maxlength: 200,
            trim: true
        },
        chatId: {
            type: ObjectId,
            required: true
        },
        creationDate: {
            type: Number,
            required: true
        }
    }
)

schema.virtual('chat', {
    ref: 'Chats',
    localField: 'chatId',
    foreignField: '_id',
    justOne: true
})

schema.statics.findByRemoteIds = async function(remoteIds){
    return this.find({remoteId: { $in : remoteIds }})
}

schema.methods.toDTO = function () {
    return {
        remoteId: this.remoteId,
        content: this.content,
        creationDate: this.creationDate
    }
}

schema.methods.toPopulatedDTO = function(chatRemoteId){
    const dto = this.toDTO()
    dto.chatRemoteId = chatRemoteId || this.chat.remoteId
    return dto
}

module.exports = model('ChatNotifications', schema)