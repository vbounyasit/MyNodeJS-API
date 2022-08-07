const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        notifications: [ String ],
        stickied: [ String ],
        userId: {
            type: ObjectId,
            required: true,
            unique: true
        }
    }
)

schema.methods.toDTO = function() {
    return {
        notifications: this.notifications, 
        stickied: this.stickied
    }
}

schema.statics.updateSettings = async function(userId, settings){
    return this.updateOne({userId}, { 
        $set: {
            notifications: settings.notifications,
            stickied: settings.stickied
        } 
    })
}

module.exports = model('ChatSettings', schema)