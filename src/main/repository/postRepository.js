const PostVotesModel = require('../models/entity/posts/postVote')
const GroupModel = require('../models/entity/groups/group')
const CommentModel = require('../models/entity/comments/comment')
const PostMediaModel = require('../models/entity/posts/postMedia')
const utils = require("../utils")

module.exports = (postSchema) => {

    /**
     * Creates a post in a group by a given user
     * @param {ObjectId} userId The id of the user creating a post
     * @param {ObjectId} groupId The id of the group to create the post in
     * @param {content: string, medias: Array[string]} postMetadata The post creation metadata
     * @returns The newly created post
     */
    postSchema.statics.createPost = async function (userId, groupId, postMetadata) {
        const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
        if (!isParticipant) throw new Error()
        if (postMetadata.content.length <= 0) throw new Error()
        const newPost = new this({
            content: postMetadata.content,
            votesCount: 0,
            commentsCount: 0,
            creationDate: Date.now(),
            creatorId: userId,
            groupId: groupId
        })
        newPost.remoteId = utils.encodeId(newPost._id)
        await newPost.save()
        if (postMetadata.medias && postMetadata.medias.length > 0) {
            const medias = postMetadata.medias.map(media => {
                const newPostMedia = new PostMediaModel({
                    postId: newPost._id,
                    content: media
                })
                newPostMedia.remoteId = utils.encodeId(newPostMedia._id)
                return newPostMedia
            })
            await PostMediaModel.collection.insertMany(medias)
        }
        return {
            remoteId: newPost.remoteId
        }
    }

    //TODO pagination + get posts indexed by creationDate desc
    /**
     * Retrieves the post list from a group
     * @param {ObjectId} userId The id of the user getting the post list
     * @param {ObjectId} groupId The id of the group to get the posts from
     * @returns The list of posts
     */
    postSchema.statics.getPosts = async function (userId, groupId) {
        const participant = await GroupModel.getGroupParticipant(userId, groupId)
        if (!participant) throw new Error()
        await participant.save()
        const posts = await this.findByGroupId(groupId)
        posts.sort((a, b) => b.creationDate - a.creationDate)
        await this.populate(posts, [
            'creator',
            'medias',
            { path: 'group', select: 'remoteId' },
            { path: 'vote', match: { userId } }
        ])
        return posts.map(post => post.toPopulatedDTO(userId))
    }

    /**
     * Retrieves data on a given post by a given user
     * @param {ObjectId} userId The id of the user retrieving the post data
     * @param {ObjectId} groupId The id of the group the post is in
     * @param {ObjectId} postId The id of the given post
     * @returns The post data
     */
    postSchema.statics.getPost = async function (userId, groupId, postId) {
        const participant = await GroupModel.getGroupParticipant(userId, groupId)
        if (!participant) throw new Error()
        const post = await this.findByGroupIdAndPostId(groupId, postId)
        await post.populate([
            'creator',
            'medias',
            { path: 'group', select: 'remoteId' },
            { path: 'vote', match: { userId } }
        ])
        return post.toPopulatedDTO(userId)
    }


    /**
     * Update a list of posts owned by a given user
     * @param {ObjectId} userId The id of the user updating the posts
     * @param { [ { postRemoteId: string, 
     *              groupRemoteId: string,
     *              content: string, 
     *              medias: [string] } ] } payload The update payload
     * @returns The update result
     */
    postSchema.statics.updatePosts = async function (userId, payload) {
        const bulkUpdate = await Promise.all(
            payload.map(async post => {
                const groupId = utils.decodeRemoteId(post.groupRemoteId)
                const participant = await GroupModel.getGroupParticipant(userId, groupId)
                if (!participant) throw new Error()
                return {
                    updateOne: {
                        filter: {
                            creatorId: userId,
                            remoteId: post.postRemoteId,
                            groupId: groupId
                        },
                        update: {
                            $set: {
                                content: post.content,
                                medias: post.medias,
                                editDate: Date.now()
                            }
                        }
                    }
                }
            })
        )
        const writeResult = await this.bulkWrite(bulkUpdate)

        if (writeResult.nMatched < payload.length) throw new Error()
        return {
            matched: writeResult.nMatched,
            modified: writeResult.nModified
        }
    }

    /**
     * Updates a list of post's vote states (downvoted/upvoted)
     * @param {ObjectId} userId The id of the user downvoting/upvoting the post
     * @param { postRemoteId: string, 
     *          groupRemoteId: string,
     *          voteState: number ({-1, 0, 1}) } payload The update payload
     * @returns The update result
     */
    postSchema.statics.updatePostVoteState = async function (userId, payload) {
        //checking group participation and calculating vote values
        payload = await Promise.all(
            payload.map(async post => {
                const postId = utils.decodeRemoteId(post.postRemoteId)
                const groupId = utils.decodeRemoteId(post.groupRemoteId)
                const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
                if (!isParticipant) throw new Error()
                const vote = await PostVotesModel.findByUserIdAndPostId(userId, postId)
                const voteState = vote ? vote.voteState : 0
                const newVoteState = Math.max(-1, Math.min(1, post.voteState))
                return { postId, groupId, voteState, newVoteState }
            })
        )
        //updating post vote result
        const postsUpdate = payload.map(post => {
            return {
                updateOne: {
                    filter: { _id: post.postId, groupId: post.groupId },
                    update: { $inc: { votesCount: post.newVoteState - post.voteState } }
                }
            }
        })
        //updating post's user vote state 
        const votesUpdate = payload.map(post => {
            const postId = post.postId
            return post.newVoteState == 0 ? {
                deleteOne: { filter: { userId, postId } }
            } : {
                updateOne: {
                    filter: { userId, postId },
                    update: { $set: { voteState: post.newVoteState } },
                    upsert: true
                }
            }
        })
        const writeResult = await this.bulkWrite(postsUpdate)
        if (writeResult.nMatched < payload.length) throw new Error()
        await PostVotesModel.bulkWrite(votesUpdate)
        return {
            matched: writeResult.nMatched,
            modified: writeResult.nModified
        }
    }

    /**
     * Deletes a list of posts created by a given user
     * @param {ObjectId} userId The id of the user deleting the posts
     * @param { postRemoteId: string, groupRemoteId: string } payload The deletion payload
     * @returns The deletion result
     */
    postSchema.statics.deletePosts = async function (userId, payload) {
        let deleted = 0
        await Promise.all(
            payload.map(async post => {
                const groupId = utils.decodeRemoteId(post.groupRemoteId)
                const participant = await GroupModel.getGroupParticipant(userId, groupId)
                if (!participant) throw new Error()
                const postId = utils.decodeRemoteId(post.postRemoteId)
                const result = !participant.isAdmin ?
                    await this.deleteByIdAndCreatorIdAndGroupId(postId, userId, groupId) :
                    await this.deleteByIdAndGroupId(postId, groupId)

                if (!result.acknowledged) throw new Error()
                deleted += 1
            })
        )
        return {
            matched: payload.length,
            deleted: deleted
        }
    }

    /**
     * Keeps the list of posts that the user have access to (participant of the group containing the post)
     * The input posts is a list of post remote ids
     * @param {ObjectId} userId The id of the user
     * @param {Array[string]} inputPosts the input post remote id list
     * @returns The filtered list of posts
     */
    postSchema.statics.getVisiblePostIds = async function (userId, inputPosts) {
        let posts = await this.findByRemoteIds(inputPosts)
        posts = await Promise.all(
            posts.map(async post => {
                const isGroupParticipant = GroupModel.getGroupParticipant(userId, post.groupId)
                return {
                    remoteId: post.remoteId,
                    isParticipant: isGroupParticipant
                }
            })
        )
        return posts.filter(post => post.isParticipant).map(post => post.remoteId)
    }

}