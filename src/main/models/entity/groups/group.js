const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId
const PostModel = require('../posts/post')
const repository = require('../../../repository/groupRepository')
const utils = require('../../../utils')

const schema = new Schema(
    {
        remoteId: {
            type: String,
            unique: true,
            required: true
        },
        description: String,
        backgroundPicture: String,
        chatId: {
            type: ObjectId,
            required: true,
            unique: true
        }
    },
    {
        timestamps: true
    }
)
schema.index({remoteId: 1, chatId: 1}, { unique: true })

schema.virtual('chat', {
    ref: 'Chats',
    localField: 'chatId',
    foreignField: '_id',
    justOne: true
})

schema.methods.toDTO = function() {
    return {
        remoteId: this.remoteId,
        description: utils.capitalize(this.description),
        backgroundPicture: this.backgroundPicture
    }
}

schema.statics.findByChatId = async function(chatId){
    return this.findOne({chatId})
}

schema.statics.findByRemoteId = async function(remoteId){
    return this.findOne({remoteId})
}

schema.statics.findByRemoteIds = async function(remoteIds){
    return this.find({remoteId: { $in : remoteIds }})
}

repository(schema)

schema.pre('deleteOne', async function (next) {
    const entity = await this.getQuery()
    const query = { groupId: entity._id }
    await PostModel.deleteMany(query)
    next()
})

module.exports = model('Groups', schema)