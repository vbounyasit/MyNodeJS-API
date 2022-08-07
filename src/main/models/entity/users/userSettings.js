const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        language: {
            type: String,
            enum: ['ENGLISH', 'FRENCH'],
            required: true,
            default: 0
        },
        eventPushNotifications: {
            type: Boolean,
            default: true
        },
        chatPushNotifications: {
            type: Boolean,
            default: true
        },
        userId: {
            type: ObjectId,
            required: true,
            unique: true
        }
    }
)

schema.statics.updateSettings = async function(userId, settings){
    return this.updateOne({userId}, { 
        $set: {
            language: settings.language,
            eventPushNotifications: settings.eventPushNotifications,
            chatPushNotifications: settings.chatPushNotifications
        } 
    })
}

schema.methods.toDTO = function() {
    return {
        language: this.language,
        eventPushNotifications: this.eventPushNotifications,
        chatPushNotifications: this.chatPushNotifications
    }
}

module.exports = model('UserSettings', schema)