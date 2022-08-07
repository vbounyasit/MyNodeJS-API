const { Schema, model } = require('mongoose')
let ObjectId = Schema.Types.ObjectId

const schema = new Schema(
    {
        //1 - upvote, -1 - downvote, 0 - none
        voteState: {
            type: Number,
            required: true
        },
        userId: {
            type: ObjectId,
            required: true
        },
        postId: {
            type: ObjectId,
            required: true
        }
    }
)

schema.index({userId: 1, postId: 1}, { unique: true })

schema.statics.findByUserIdAndPostId = async function(userId, postId){
    return this.findOne({userId, postId})
}


module.exports = model('PostVotes', schema)