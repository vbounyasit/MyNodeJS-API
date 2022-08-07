const { Schema, model } = require('mongoose')
const bcrypt = require('bcryptjs')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        content: {
            type: String,
            required: true
        },
        deviceId: {
            type: String,
            required: true,
            unique: true
        },
        userId: {
            type: ObjectId,
            required: true
        }
    },
    { 
        timestamps: true
    }
)

schema.statics.deleteByContent = async function(content){
    return this.deleteMany({content})
}

schema.statics.findByUser = async function(user){
    return this.find({ userId: user._id })
}

schema.statics.findByUserIdAndContent = async function(id, content){
    return this.findOne({ userId: id, content })
}

schema.methods.toDTO = function() {
    return this.content
}

schema.pre('save', async function (next) {
    if (this.isModified('deviceId'))
        this.deviceId = await bcrypt.hash(this.deviceId, 8)
    next()
})


module.exports = model('UserTokens', schema)