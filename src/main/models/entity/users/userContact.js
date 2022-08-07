const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        initiatorId: {
            type: ObjectId,
            required: true
        },
        receiverId: {
            type: ObjectId,
            required: true
        },
        accepted: {
            type: Boolean,
            required: true
        },
        lastUpdated: {
            type: Number,
            required: true
        }
    }
)
schema.index({ initiatorId: 1, receiverId: 1 }, { unique: true })

schema.virtual('initiator', {
    ref: 'Users',
    localField: 'initiatorId',
    foreignField: '_id',
    justOne: true
})
schema.virtual('receiver', {
    ref: 'Users',
    localField: 'receiverId',
    foreignField: '_id',
    justOne: true
})

schema.statics.updateRelationship = async function (initiatorId, receiverId) {
    return this.findOneAndUpdate(
        { initiatorId, receiverId },
        { $set: { accepted: false, lastUpdated: Date.now() } },
        { upsert: true, new: true }
    )
}

schema.statics.findRelationship = async function (initiatorId, receiverId) {
    return this.findOne({ initiatorId, receiverId })
}
schema.statics.findInitiators = async function (receiverId, accepted) {
    return this.find({ receiverId, accepted })
}
schema.statics.findReceivers = async function (initiatorId, accepted) {
    return this.find({ initiatorId, accepted })
}
schema.statics.findContacts = async function (userId) {
    return this.find({
        $or: [ { initiatorId: userId, accepted: true }, { receiverId: userId, accepted: true } ]
    })
}

module.exports = model('UserContacts', schema)