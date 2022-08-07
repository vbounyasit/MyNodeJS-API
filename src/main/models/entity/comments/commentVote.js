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
        commentId: {
            type: ObjectId,
            required: true
        }
    }
)

schema.index({userId: 1, commentId: 1}, { unique: true })

schema.statics.findByUserIdAndCommentId = async function(userId, commentId){
    return this.findOne({userId, commentId})
}

module.exports = model('CommentVotes', schema)