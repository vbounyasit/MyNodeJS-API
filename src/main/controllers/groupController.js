const express = require('express')
const authenticate = require('../middleware/auth')
const GroupModel = require('../models/entity/groups/group')
const utils = require('../utils')

module.exports = function (io) {
    const router = new express.Router()

    router.patch('/groups', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updatedGroups = await GroupModel.updateGroups(
                authUserId,
                req.body,
                io
            )
            res.status(200).send(updatedGroups)
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update groups' })
        }
    })

    router.get('/groups', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const groupId = utils.decodeRemoteId(req.body.groupRemoteId)
            const groupData = await GroupModel.getGroupData(groupId, authUserId)
            res.status(200).send({ groupData })
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to get group data' })
        }
    })

    router.patch('/groups/settings', authenticate, async (req, res) => {
        try {
            const authUserId = req.authUserId
            const updatedSettings = await GroupModel.updateGroupSettings(
                authUserId,
                req.body.payload
            )
            res.status(200).send({ updatedGroups: updatedSettings })
        } catch (err) {
            console.log(err)
            res.status(400).send({ error: 'Unable to update group settings' })
        }
    })

    return router
}