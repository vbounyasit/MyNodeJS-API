const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {   
        notifications: [ String ],
        pushNotifications: [ String ],
        userId: {
            type: ObjectId,
            required: true,
            unique: true
        }
    }
)


schema.methods.toDTO = function() {
    return {
        notifications : this.notifications,
        pushNotifications : this.pushNotifications
    }
}


schema.statics.updateSettings = async function(userId, settings){
    return this.updateOne({userId}, { 
        $set: {
            notifications: settings.notifications,
            pushNotifications: settings.pushNotifications
        } 
    })
}

module.exports = model('GroupSettings', schema)