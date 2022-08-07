const express = require('express')
const authenticate = require('../middleware/auth')
const UserModel = require('../models/entity/users/user')

module.exports = function (io) {
    const router = new express.Router()

    /**
     * User creation
     */
    router.post('/users', async (req, res) => {
        try {
            const user = await UserModel.createUser(req.body)
            res.status(201).send(user)
        } catch (e) {
            console.log(e)
            res.status(400).send({ error: 'Unable to create user' })
        }
    })

    /**
     * User search
     */
    router.get('/users', authenticate, async (req, res) => {
        try {
            const searchResults = await req.authUser.searchUsers(req.query.searchTag)
            res.send(searchResults)
        } catch (e) {
            console.log(e)
            res.status(400).send({ error: 'Unable to execute search request' })
        }
    })

    router.get('/users/me', authenticate, async (req, res) => {
        try {
            const userData = await req.authUser.getUserData()
            res.send(userData)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get authenticated user' })
        }
    })

    router.patch('/users/me/activity', authenticate, async (req, res) => {
        try {
            const activityPingResult = await req.authUser.pingActivity()
            res.send(activityPingResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to ping user activity' })
        }
    })

    /**
     * User login
     */
    router.patch('/users/login', async (req, res) => {
        try {
            const loggedInUser = await UserModel.logUserIn(req.body)
            res.send(loggedInUser)
        } catch (e) {
            console.log(e)
            res.status(401).send({ error: 'Unable to log user in' })
        }
    })

    /**
     * User logout
     */
    router.patch('/users/logout', authenticate, async (req, res) => {
        try {
            UserModel.logUserOut(req.authToken)
            res.send({ result: 'User successfully logged out' })
        } catch (e) {
            res.status(404).send({ error: 'Could not log user out' })
        }
    })

    router.patch('/users/me', authenticate, async (req, res) => {
        try {
            const updateResult = await req.authUser.updateUser(req.body)
            res.send(updateResult)
        } catch (err) {
            res.status(401).send({ error: 'Could not update authenticated user' })
        }
    })

    router.patch('/users/settings/posts', authenticate, async (req, res) => {
        try {
            const updateResult = await req.authUser.updatePostSettings(req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update user posts settings' })
        }
    })

    router.patch('/users/settings/groups', authenticate, async (req, res) => {
        try {
            const updateResult = await req.authUser.updateGroupSettings(req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update user posts settings' })
        }
    })

    router.patch('/users/settings/chats', authenticate, async (req, res) => {
        try {
            const updateResult = await req.authUser.updateChatSettings(req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update user chats settings' })
        }
    })

    router.patch('/users/settings', authenticate, async (req, res) => {
        try {
            const updateResult = await req.authUser.updateUserSettings(req.body)
            res.status(200).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update user settings' })
        }
    })

    router.post('/users/contacts', authenticate, async (req, res) => {
        try {
            const updateResult = await req.authUser.createAddRequests(req.body.userRemoteId)
            res.status(201).send(updateResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to create add request' })
        }
    })

    router.get('/users/contacts', authenticate, async (req, res) => {
        try {
            const contactsData = await req.authUser.getContactsData()
            res.status(200).send(contactsData)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to retrieve contact requests' })
        }
    })

    router.delete('/users/contacts', authenticate, async (req, res) => {
        try {
            const deletionResult = await req.authUser.removeRequest(req.body)
            res.status(200).send(deletionResult)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to delete contact' })
        }
    })

    return router
}