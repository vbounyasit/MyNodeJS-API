const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        remoteId: {
            type: String,
            required: true
        },
        postId: {
            type: ObjectId,
            required: true
        },
        content: {
            type: String,
            required: true
        }
    }
)

schema.methods.toDTO = function(){
    return {
        remoteId: this.remoteId,
        content: this.content
    }
}

schema.index({remoteId: 1, postId: 1}, { unique: true })


module.exports = model('PostMedias', schema)