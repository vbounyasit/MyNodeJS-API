const express = require('express')
const authenticate = require('../middleware/auth')
const UserModel = require('../models/entity/users/user')
const PostModel = require('../models/entity/posts/post')
const GroupModel = require('../models/entity/groups/group')
const CommentModel = require('../models/entity/comments/comment')
const utils = require('../utils')

module.exports = function (io) {
    const router = new express.Router()

    router.post('/groups/:groupRemoteId/posts', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.params.groupRemoteId)
            const createdPost = await PostModel.createPost(
                authUserId,
                groupId,
                {
                    title: req.body.title,
                    content: req.body.content,
                    medias: req.body.medias
                }
            )
            res.status(200).send(createdPost)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to create post' })
        }
    })

    router.post('/groups/:groupRemoteId/posts/:postRemoteId/comments', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.params.groupRemoteId)
            const postId = utils.decodeRemoteId(req.params.postRemoteId)
            const createdComment = await CommentModel.createComment(
                authUserId, postId, groupId,
                {
                    content: req.body.content,
                    parentRemoteId: req.body.parentRemoteId
                }
            )
            res.status(200).send(createdComment)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to create comment' })
        }
    })

    router.get('/groups/:groupRemoteId/posts', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.params.groupRemoteId)
            const posts = await PostModel.getPosts(authUserId, groupId)
            res.status(200).send(posts)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get posts' })
        }
    })

    router.get('/groups/:groupRemoteId/posts/:postRemoteId', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.params.groupRemoteId)
            const postId = utils.decodeRemoteId(req.params.postRemoteId)
            const post = await PostModel.getPost(authUserId, groupId, postId)
            res.status(200).send(post)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get post data' })
        }
    })

    router.get('/groups/:groupRemoteId/posts/:postRemoteId/comments', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.params.groupRemoteId)
            const postId = utils.decodeRemoteId(req.params.postRemoteId)
            const comments = await CommentModel.getComments(authUserId, groupId, postId)
            res.status(200).send(comments)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get post data' })
        }
    })

    router.get('/groups/:groupRemoteId/posts/:postRemoteId/comments/:commentRemoteId', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.params.groupRemoteId)
            const postId = utils.decodeRemoteId(req.params.postRemoteId)
            const commentId = utils.decodeRemoteId(req.params.commentRemoteId)
            const comment = await CommentModel.getComment(authUserId, groupId, postId, commentId)
            res.status(200).send(comment)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get comment data' })
        }
    })

    router.patch('/groups/posts', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updateResult = await PostModel.updatePosts(authUserId, req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to edit posts' })
        }
    })

    router.patch('/groups/posts/comments', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updateResult = await CommentModel.updateComments(authUserId, req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to edit comments' })
        }
    })

    router.delete('/groups/posts', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const deletionResult = await PostModel.deletePosts(authUserId, req.body)
            res.status(200).send(deletionResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to delete post' })
        }
    })

    router.delete('/groups/posts/comments', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const deletionResult = await CommentModel.deleteComments(authUserId, req.body)
            res.status(200).send(deletionResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to delete comments' })
        }
    })

    router.patch('/groups/posts/votes', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updateResult = await PostModel.updatePostVoteState(authUserId, req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to edit post vote states' })
        }
    })

    router.patch('/groups/posts/comments/votes', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updateResult = await CommentModel.updateCommentVoteState(authUserId, req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to edit comment vote states' })
        }
    })

    return router
}