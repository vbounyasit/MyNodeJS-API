const { Schema, model } = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const repository = require('../../../repository/userRepository')
const utils = require('../../../utils')

const schema = new Schema(
    {
        remoteId: {
            type: String,
            unique: true,
            required: true
        },
        email: {
            type: String,
            unique: true,
            required: true,
            trim: true,
            lowercase: true,
            validate: {
                validator: async (value) => { return validator.isEmail(value) },
                message: props => `${props.value} is not a valid email`
            }
        },
        username: {
            type: String,
            unique: true,
            required: true,
            trim: true,
            minlength: 5,
            maxlength: 20,
            lowercase: true
        },
        password: {
            type: String,
            required: true,
            minlength: 7,
            maxlength: 20,
            trim: true
        },
        firstName: {
            type: String,
            minlength: 2,
            maxlength: 20,
            required: true,
            trim: true
        },
        lastName: {
            type: String,
            minlength: 2,
            maxlength: 20,
            required: true,
            trim: true
        },
        description: String,
        profilePicture: String,
        profileBackgroundPicture: String,
        gender: {
            type: String,
            enum: ['MALE', 'FEMALE'],
            required: true
        },
        birthDay: {
            type: String,
            required: true
        },
        lastActive: {
            type: Number,
            required: true
        }
    },
    {
        timestamps: true
    }
)

schema.virtual('settings', {
    ref: 'UserSettings',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
})

schema.virtual('postSettings', {
    ref: 'PostSettings',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
})

schema.virtual('chatSettings', {
    ref: 'ChatSettings',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
})

schema.virtual('groupSettings', {
    ref: 'GroupSettings',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
})

schema.methods.toDTO = function () {
    var ageDifMs = Date.now() - new Date(this.birthDay).getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    const cFirstName = utils.capitalize(this.firstName)
    const cLastName = utils.capitalize(this.lastName)
    return {
        remoteId: this.remoteId,
        email: this.email,
        firstName: cFirstName,
        lastName: cLastName,
        profilePicture: this.profilePicture,
        profileBackgroundPicture: this.profileBackgroundPicture,
        description: this.description,
        gender: this.gender,
        age: age,
        creationTimeStamp: this.createdAt.getTime(),
        updateTimeStamp: this.updatedAt.getTime()
    }
}

schema.methods.toContact = function () {
    const cFirstName = utils.capitalize(this.firstName)
    const cLastName = utils.capitalize(this.lastName)
    return {
        firstName: cFirstName,
        lastName: cLastName,
        fullName: `${cFirstName} ${cLastName}`,
        profilePicture: this.profilePicture,
        profileBackgroundPicture: this.profileBackgroundPicture,
        remoteId: this.remoteId,
        lastActive: this.lastActive
    }
}

schema.statics.findAll = async function () {
    return this.find()
}
schema.statics.findByUsername = async function (username) {
    return this.findOne({ username })
}
schema.statics.findByEmail = async function (email) {
    return this.findOne({ email })
}
schema.statics.searchUserByNameNotIn = async function(searchTag, maxResults, forbiddenIds){
    return this.searchUserByName(searchTag, maxResults, { $not: { $in: forbiddenIds } })
}
schema.statics.searchUserByNameIn = async function(searchTag, maxResults, ids){
    return this.searchUserByName(searchTag, maxResults, { $in: ids } )
}
schema.statics.searchUserByName = async function (searchTag, maxResults, inQuery) {
    return this.find(
        {
            $and: [
                {
                    $or: [
                        { firstName: { $regex: searchTag, $options: 'i' } },
                        { lastName: { $regex: searchTag, $options: 'i' } }
                    ]
                },
                { remoteId: inQuery }
            ]
        }
    ).limit(maxResults).sort({ firstName: 1, lastName: 1 })
}

schema.statics.updateLastActive = async function (userId, lastActive) {
    return this.updateOne({ _id: userId }, { $set: { lastActive } })
}

schema.statics.updateUser = async function (userId, data) {
    return this.updateOne({ _id: userId }, {
        $set: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            profilePicture: data.profilePicture,
            description: data.description
        }
    }, { runValidators: true })
}

schema.pre('save', async function (next) {
    if (this.isModified('password'))
        this.password = await bcrypt.hash(this.password, 8)
    next()
})

repository(schema)

module.exports = model('Users', schema)