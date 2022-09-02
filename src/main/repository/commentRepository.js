const constants = require("../constants")
const GroupModel = require('../models/entity/groups/group')
const CommentVotesModel = require('../models/entity/comments/commentVote')
const utils = require("../utils")

module.exports = (commentSchema) => {

    /**
     * Gets all data related to a given comment
     * @returns The full comment data
     */
    commentSchema.methods.getPopulatedComment = function () {
        const voteState = this.vote ? this.vote.voteState : 0
        return {
            data: this.toDTO(),
            voteState: voteState,
            creator: this.creator.toContact(),
        }
    }

    /**
     * Creates a comment on a given post by a given user
     * @param {ObjectId} userId The id of the user creating the comment
     * @param {ObjectId} postId The id of the post to create the comment for
     * @param {ObjectId} groupId The id of the group the post belongs to
     * @param {parentRemoteId: string, content: string} contentMetadata 
     * @returns The newly created comment
     */
    commentSchema.statics.createComment = async function (userId, postId, groupId, contentMetadata) {
        const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
        if (!isParticipant) throw new Error()
        const newComment = new this({
            content: contentMetadata.content,
            voteCount: 0,
            creatorId: userId,
            postId: postId,
            groupId: groupId,
            children: [],
            isLast: true,
            parentRemoteId: contentMetadata.parentRemoteId
        })
        newComment.remoteId = utils.encodeId(newComment._id)
        await newComment.populate([{ path: 'post', match: { groupId } }, 'creator', 'vote'])
        if (!newComment.post) throw new Error()
        await newComment.post.increaseCommentsCount(1)
        if (newComment.parentRemoteId) {
            await this.updateChildrenLastReply(newComment.parentRemoteId)
            let initialValue = newComment
            do {
                const predecessor = await this.findByRemoteId(initialValue.parentRemoteId)
                if (!newComment.depthLevel) {
                    if (predecessor.depthLevel >= constants.COMMENTS_MAX_DEPTH_LEVEL)
                        throw new Error()
                    newComment.depthLevel = predecessor.depthLevel + 1
                }
                predecessor.children.push(newComment.remoteId)
                initialValue = await predecessor.save()
            } while (initialValue.parentRemoteId)
        } else newComment.depthLevel = 0
        await newComment.save()
        return { remoteId: newComment.remoteId }
    }

    /**
     * Retrieve the list of comments for a given post
     * @param {ObjectId} userId The id of the user retrieving the data
     * @param {ObjectId} groupId The id of the group containing the post
     * @param {ObjectId} postId The id of the post to get the comment for
     * @returns The list of ordered comments
     */
    commentSchema.statics.getComments = async function (userId, groupId, postId) {
        const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
        if (!isParticipant) throw new Error()
        const comments = await this.findByGroupIdAndPostId(groupId, postId)
        const orderedComments = await this.getOrderedComments(comments)
        await this.populate(orderedComments, [
            'creator', 
            'vote', 
            { path: 'post', select: 'remoteId' },
            { path: 'group', select: 'remoteId' }
        ])
        return orderedComments.map(comment => comment.toPopulatedDTO(userId))
    }

    /**
     * Retrieve the list of comments for a given post and 
     * order them by creation date (desc), featuring a list of ordered replies underneath each comment
     * - Orders the list of comments by descending createdAt
     * - Builds a directional graph where vertices are comments and edges go from a comment to its children
     * - Applies DFS algorithm to discover the graph and put comments right above their child comments
     * @param {Array[CommentModel]} comments The list of comments to order
     * @returns The list of ordered comments
     */
    commentSchema.statics.getOrderedComments = async function (comments) {
        const result = []
        //building the comment graph
        const graph = new Map()
        comments.forEach(comment => {
            const key = comment.parentRemoteId || 'N/A'
            const value = graph.get(key)
            if (value == null) graph.set(key, [comment])
            else value.push(comment)
        })
        //dfs algorithm
        function dfs(node) {
            if (node.remoteId != 'N/A') {
                result.push(node)
            }
            const neighbors = graph.get(node.remoteId)
            if (!neighbors) return
            neighbors.forEach(nextNode => {
                dfs(nextNode)
            })
        }
        dfs({ remoteId: 'N/A' })
        return result
    }

    commentSchema.statics.getComment = async function (userId, groupId, postId, commentId) {
        const participant = await GroupModel.getGroupParticipant(userId, groupId)
        if (!participant) throw new Error()
        const comment = await this.findByGroupIdAndPostIdAndId(groupId, postId, commentId)
        await comment.populate([
            'creator',
            { path: 'post', select: 'remoteId' },
            { path: 'group', select: 'remoteId' },
            { path: 'vote', match: { userId } }
        ])
        return comment.toPopulatedDTO(userId)
    }

    /**
     * Update a list of comments written by a given user
     * @param {ObjectId} userId The id of the user updating the comment
     * @param { [ { commentRemoteId: string,
     *              groupRemoteId: string,
     *              content: string } ] } payload The update payload
     * @returns The update result
     */
    commentSchema.statics.updateComments = async function (userId, payload) {
        const bulkUpdate = await Promise.all(
            payload.map(async comment => {
                const groupId = utils.decodeRemoteId(comment.groupRemoteId)
                const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
                if (!isParticipant) throw new Error()
                return {
                    updateOne: {
                        filter: {
                            creatorId: userId,
                            remoteId: comment.commentRemoteId,
                            groupId: groupId
                        },
                        update: {
                            $set: {
                                content: comment.content
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
     * Updates a list of comment's vote states (downvoted/upvoted)
     * @param {ObjectId} userId The id of the user downvoting/upvoting the comment
     * @param { commentRemoteId: string, 
     *          groupRemoteId: string,
     *          voteState: number ({-1, 0, 1}) } payload The update payload
     * @returns The update result
     */
    commentSchema.statics.updateCommentVoteState = async function (userId, payload) {
        //checking group participation and calculating vote values
        payload = await Promise.all(
            payload.map(async comment => {
                const commentId = utils.decodeRemoteId(comment.commentRemoteId)
                const groupId = utils.decodeRemoteId(comment.groupRemoteId)
                const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
                if (!isParticipant) throw new Error()
                const vote = await CommentVotesModel.findByUserIdAndCommentId(userId, commentId)
                const voteState = vote ? vote.voteState : 0
                const newVoteState = Math.max(-1, Math.min(1, comment.voteState))
                return { commentId, groupId, voteState, newVoteState }
            })
        )
        //updating comment vote result
        const commentsUpdate = payload.map(comment => {
            return {
                updateOne: {
                    filter: { _id: comment.commentId, groupId: comment.groupId },
                    update: { $inc: { voteCount: comment.newVoteState - comment.voteState } }
                }
            }
        })
        //updating comment's user vote state 
        const votesUpdate = payload.map(comment => {
            const commentId = comment.commentId
            return comment.newVoteState == 0 ? {
                deleteOne: { filter: { userId, commentId } }
            } : {
                updateOne: {
                    filter: { userId, commentId },
                    update: { $set: { voteState: comment.newVoteState } },
                    upsert: true
                }
            }
        })
        const writeResult = await this.bulkWrite(commentsUpdate)
        if (writeResult.nMatched < payload.length) throw new Error()
        await CommentVotesModel.bulkWrite(votesUpdate)
        return {
            matched: writeResult.nMatched,
            modified: writeResult.nModified
        }
    }

    /**
     * Removes a comment written by a given user along side all the related replies (child comments)
     * @param {ObjectId} userId The id of the user deleting the comments
     * @param { [ { groupRemoteId: string, commentRemoteId: string } ] } payload The deletion payload
     * @returns The deleted comment remote id and the total deletion count (including children)
     */
    commentSchema.statics.deleteComments = async function (userId, payload) {
        let matched = 0
        let deleted = 0
        await Promise.all(
            payload.map(async comment => {
                const groupId = utils.decodeRemoteId(comment.groupRemoteId)
                const isParticipant = await GroupModel.getGroupParticipant(userId, groupId)
                if (!isParticipant) throw new Error()
                const commentId = utils.decodeRemoteId(comment.commentRemoteId)
                const deletedComment = await this.findAndDeleteByIdAndCreatorId(commentId, userId)
                if(!deletedComment) throw new Error()
                if(deletedComment.parentRemoteId) {
                    const latestChild = await this.findLatestChild(deletedComment.parentRemoteId)
                    if(latestChild) {
                        latestChild.isLast = true
                        await latestChild.save()
                    }
                }
                matched += 1
                deleted += 1
                const childrenIds = deletedComment.children.map(child => utils.decodeRemoteId(child))
                const childrenDeletionResult = await this.deleteByIds(childrenIds)
                const deletedCommentsCount = childrenDeletionResult.deletedCount + 1
                deleted += deletedCommentsCount
                await deletedComment.populate('post')
                deletedComment.post.decreaseCommentsCount(deletedCommentsCount)
            })
        )
        return { matched, deleted }
    }

}