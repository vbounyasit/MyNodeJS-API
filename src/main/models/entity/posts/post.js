const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId
const CommentModel = require('../comments/comment')
const PostVotesModel = require('../posts/postVote')

const repository = require('../../../repository/postRepository')

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
            maxlength: 20000
        },
        votesCount: {
            type: Number,
            required: true
        },
        commentsCount: {
            type: Number,
            required: true
        },
        creationDate: {
            type: Number,
            required: true
        },
        creatorId: {
            type: ObjectId,
            required: true
        },
        groupId: {
            type: ObjectId,
            required: true
        },
        editDate: Number
    }
)

schema.virtual('creator', {
    ref: 'Users',
    localField: 'creatorId',
    foreignField: '_id',
    justOne: true
})

schema.virtual('group', {
    ref: 'Groups',
    localField: 'groupId',
    foreignField: '_id',
    justOne: true
})

schema.virtual('vote', {
    ref: 'PostVotes',
    localField: '_id',
    foreignField: 'postId',
    justOne: true
})

schema.virtual('comments', {
    ref: 'Comments',
    localField: '_id',
    foreignField: 'postId'
})

schema.virtual('medias', {
    ref: 'PostMedias',
    localField: '_id',
    foreignField: 'postId'
})

schema.methods.toDTO = function(){
    return {
        remoteId: this.remoteId,
        content: this.content,
        votesCount: this.votesCount,
        commentsCount: this.commentsCount,
        creationDate: this.creationDate,
        editDate: this.editDate
    }
}
schema.methods.toPopulatedDTO = function(userId) {
    const dto = this.toDTO()
    const voteState = this.vote ? this.vote.voteState : 0
    dto.voteState = voteState
    dto.creator = this.creator.toContact()
    dto.isCreator = this.creatorId.toString() == userId
    dto.medias = this.medias.map(media => media.toDTO())
    dto.groupRemoteId = this.group.remoteId
    return dto
}

schema.statics.findByRemoteIds = async function(remoteIds){
    return this.find({remoteId: { $in : remoteIds }})
}
schema.statics.findByGroupId = async function(groupId){
    return this.find({groupId})
}
schema.statics.findByGroupIdAndPostId = async function(groupId, _id){
    return this.findOne({groupId, _id})
}
schema.statics.deleteByIdAndCreatorIdAndGroupId = async function(postId, creatorId, groupId) {
    return this.deleteOne({postId, creatorId, groupId})
}
schema.statics.deleteByIdAndGroupId = async function(postId, groupId) {
    return this.deleteOne({postId, groupId})
}
schema.methods.increaseCommentsCount = async function(count){
    this.commentsCount = this.commentsCount + count
    return this.save()
}
schema.methods.decreaseCommentsCount = async function(count){
    this.commentsCount = this.commentsCount - count
    return this.save()
}

repository(schema)

schema.pre('deleteOne', async function (next) {
    const entity = await this.getQuery()
    const query = { postId: entity.postId }
    await PostVotesModel.deleteMany(query)
    await CommentModel.deleteMany(query)
    next()
})

module.exports = model('Posts', schema)