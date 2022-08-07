const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId
const CommentVotesModel = require('../comments/commentVote')

const repository = require('../../../repository/commentRepository')
const utils = require('../../../utils')


const schema = new Schema(
    {
        remoteId: {
            type: String,
            unique: true,
            required: true
        },
        content: {
            type: String,
            required: true,
            minLength: 1,
            maxlength: 10000
        },
        voteCount: {
            type: Number,
            required: true
        },
        depthLevel: {
            type: Number,
            required: true
        },
        isLast: {
            type: Boolean,
            required: true
        },
        creationDate: {
            type: Number,
            required: true
        },
        editDate: Number,
        creatorId: {
            type: ObjectId,
            required: true
        },
        postId: {
            type: ObjectId,
            required: true
        },
        groupId: {
            type: ObjectId,
            required: true
        },
        children: [String],
        parentRemoteId: String
    }
)

schema.virtual('creator', {
    ref: 'Users',
    localField: 'creatorId',
    foreignField: '_id',
    justOne: true
})

schema.virtual('vote', {
    ref: 'CommentVotes',
    localField: '_id',
    foreignField: 'commentId',
    justOne: true
})

schema.virtual('post', {
    ref: 'Posts',
    localField: 'postId',
    foreignField: '_id',
    justOne: true
})

schema.virtual('group', {
    ref: 'Groups',
    localField: 'groupId',
    foreignField: '_id',
    justOne: true
})

schema.methods.toDTO = function () {
    return {
        remoteId: this.remoteId,
        content: this.content,
        voteCount: this.voteCount,
        depthLevel: this.depthLevel,
        isLast: this.isLast,
        creationDate: this.creationDate,
        editDate: this.editDate,
        parentRemoteId: this.parentRemoteId
    }
}

schema.methods.toPopulatedDTO = function (userId) {
    const dto = this.toDTO()
    const voteState = this.vote ? this.vote.voteState : 0
    dto.voteState = voteState
    dto.creator = this.creator.toContact()
    dto.isCreator = this.creatorId.toString() == userId
    dto.postRemoteId = this.post.remoteId
    dto.groupRemoteId = this.group.remoteId
    return dto
}

schema.statics.findByGroupIdAndPostId = async function (groupId, postId) {
    return this.find({ groupId, postId })
}

schema.statics.findByGroupIdAndPostIdAndId = async function (groupId, postId, _id) {
    return this.findOne({ groupId, postId, _id })
}

schema.statics.updateChildrenLastReply = async function (parentRemoteId) {
    return this.updateMany(
        {
            parentRemoteId: parentRemoteId,
            isLast: true
        }, {
        $set: { isLast: false }
    })
}
schema.statics.findLatestChild = async function(parentRemoteId) {
    return this.findOne({ parentRemoteId }).sort({ creationDate: -1 })
}


schema.statics.findByRemoteId = async function (remoteId) {
    return this.findOne({ remoteId })
}

schema.statics.deleteByIds = async function (ids) {
    return this.deleteMany({ _id: { $in: ids } })
}

schema.statics.findAndDeleteByIdAndCreatorId = async function (_id, creatorId) {
    return this.findOneAndDelete({ _id, creatorId })
}

repository(schema)


schema.pre('findOneAndDelete', async function () {
    const entity = this.getQuery()
    await CommentVotesModel.deleteMany({ commentId: entity._id })
})

schema.pre('deleteMany', async function () {
    const entity = this.getQuery()
    const query = entity._id ? { commentId: entity._id } : entity.postId ? { postId: entity.postId } : null
    await CommentVotesModel.deleteMany(query)
})

module.exports = model('Comments', schema)