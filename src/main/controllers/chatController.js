const express = require('express')
const authenticate = require('../middleware/auth')
const ChatModel = require('../models/entity/chats/chat')
const GroupModel = require('../models/entity/groups/group')
const UserModel = require('../models/entity/users/user')
const utils = require('../utils')

module.exports = function(io) {
    const router = new express.Router()

    router.post('/chats', authenticate, async (req, res) => {
        try {
            const createdChat = await ChatModel.createAndinitializeChat(
                req.authUserRemoteId,
                {
                    name: req.body.name,
                    profilePicture: req.body.profilePicture,
                    firstChatLog: req.body.firstChatLog
                },
                req.body.participants,
                io)
            res.status(201).send(createdChat)
        } catch (e) {
            console.log(e)
            res.status(400).send({ error: 'Unable to create Chat entity' })
        }
    })

    router.post('/chats/logs', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const chatLogs = await ChatModel.createChatLogs(authUserId, req.body, io)
            res.status(200).send(chatLogs)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to create chat logs' })
        }
    })
    

    router.get('/chats', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const chatList = await ChatModel.getChatList(authUserId)
            res.status(200).send(chatList)
        } catch (e) {
            console.log(e)
            res.status(400).send({ error: 'Unable to get Chat list for user' })
        }
    })
    

    router.post('/chats/get', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const chatList = await ChatModel.getChatList(authUserId, req.body)
            res.status(200).send(chatList)
        } catch (e) {
            console.log(e)
            res.status(400).send({ error: 'Unable to get Chat list for user' })
        }
    })

    router.get('/chats/:remoteId', authenticate, async (req, res) => {
        try {
            const chatId = utils.decodeRemoteId(req.params.remoteId)
            const authUserId = req.authUserId
            const chatData = await ChatModel.getChatData(chatId, authUserId)
            res.status(200).send(chatData)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to obtain Chat data' })
        }
    })

    router.get('/chats/:remoteId/logs', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const chatBubbles = await ChatModel.getChatBubbles(authUserId, req.params.remoteId)
            res.status(200).send(chatBubbles)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to obtain Chat logs' })
        }
    })
    
    router.post('/chats/logs/get', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const newChatLogs = await ChatModel.getNewChatLogs(authUserId, req.body)
            res.status(200).send(newChatLogs)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get new chat logs' })
        }
    })
    
    router.post('/chats/notifications/get', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const newChatNotifications = await ChatModel.getNewChatNotifications(authUserId, req.body)
            res.status(200).send(newChatNotifications)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get new chat notifications' })
        }
    })

    router.patch('/chats/:remoteId/read', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const chatId = utils.decodeRemoteId(req.params.remoteId)
            const readResult = await ChatModel.readChat(authUserId, chatId, io)
            res.status(200).send(readResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update Chat entities' })
        }
    })

    router.patch('/groups/:remoteId/read', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const readResult = await GroupModel.readGroup(authUserId, req.params.remoteId)
            res.status(200).send(readResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update Group entities' })
        }
    })

    router.patch('/chats', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updatedChats = await ChatModel.updateChats(authUserId, req.body.payload)
            res.status(200).send(updatedChats)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update Chat entities' })
        }
    })
    router.post('/chat/participants', authenticate, async (req, res) => {
        try {
            const chatId = utils.decodeRemoteId(req.body.chatRemoteId)
            const authUserId = req.authUserId
            const addedParticipants = await ChatModel.addChatParticipants(chatId, authUserId, req.body.participants, Date.now())
            res.status(200).send({ addedParticipants })
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to add participants' })
        }
    })

    router.patch('/chat/participants', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updatedParticipants = await ChatModel.updateChatParticipants(authUserId, req.body.payload)
            res.status(200).send({ updatedParticipants })
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update Participants' })
        }
    })

    router.delete('/chat/participant', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const chatId = utils.decodeRemoteId(req.body.chatRemoteId)
            const participantId = utils.decodeRemoteId(req.body.participantRemoteId)
            const deletionResult = await ChatModel.deleteParticipant(
                chatId,
                authUserId,
                participantId,
                io
            )
            res.status(200).send({ deletionResult })
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to delete Participant' })
        }
    })
    return router
}