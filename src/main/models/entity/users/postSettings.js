const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        notifications: [ String ],
        stickied: [ String ],
        saved: [ String ],
        userId: {
            type: ObjectId,
            required: true,
            unique: true
        }
    }
)

schema.methods.toDTO = function(){
    return {
        notifications: this.notifications, 
        stickied: this.stickied, 
        saved: this.saved
    }
}

schema.statics.updateSettings = async function(userId, settings){
    return this.updateOne({userId}, { 
        $set: {
            notifications: settings.notifications,
            stickied: settings.stickied,
            saved: settings.saved
        } 
    })
}

module.exports = model('PostSettings', schema)