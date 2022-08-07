const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        participantId: {
            type: ObjectId,
            required: true
        }, 
        isAdmin: {
            type: Boolean,
            required: true, 
        },
        lastReadTime: Number,
        lastGroupReadTime: Number,
        chatId: {
            type: ObjectId,
            required: true
        }
    }
)

schema.index({participantId: 1, chatId: 1}, { unique: true })

schema.virtual('user', {
    ref: 'Users',
    localField: 'participantId',
    foreignField: '_id',
    justOne: true
})

schema.virtual('chat', {
    ref: 'Chats',
    localField: 'chatId',
    foreignField: '_id',
    justOne: true
})

schema.methods.toDTO = function(){
    return {
        isAdmin: this.isAdmin,
        lastReadTime: this.lastReadTime
    }
}
schema.statics.deleteByChatIdAndParticipantId = async function(chatId, participantId) {
    return this.deleteOne({ chatId, participantId })
}

schema.statics.findByChatIdAndParticipantId = async function(chatId, participantId) {
    return this.findOne({ chatId, participantId })
}

schema.statics.findByParticipantId = async function(participantId){
    return this.find({ participantId })
}

schema.statics.findByChatId = async function(chatId){
    return this.find({ chatId })
}

module.exports = model('ChatParticipants', schema)